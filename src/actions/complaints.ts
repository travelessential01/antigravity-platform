'use server'

/**
 * complaints.ts — Complaint Server Actions
 * Sprint A.2 + A.3 + A.4 Refactor
 *
 * CHANGES FROM PRE-SPRINT:
 *   [A.2] Replaced 12-line raw getSession() boilerplate in readComplaintPHI
 *         with requireUser() + createAuthenticatedClient() from auth-guard.ts.
 *   [A.3] Removed all @opentelemetry/api imports and usages. Replaced with
 *         no-op stubs via telemetry.ts. OTEL tracer.startActiveSpan wrapper removed.
 *   [A.4] Removed dedupHash from Zod schema and destructuring (offline CRDT field).
 */

import { requireUser, createAuthenticatedClient, AuthError } from '@/lib/auth-guard'
import crypto from 'crypto'
import { isIP } from 'node:net'
import { headers } from 'next/headers'
import { z } from 'zod'
import * as Sentry from '@sentry/nextjs';
import { decryptionLatencyHistogram, serverActionErrorCounter } from '@/lib/telemetry'
import { createAdminClient } from '@/lib/supabase-admin'
import { logger } from '@/lib/logger'
import { normalizePatientContact } from '@/lib/patient-contact'
import {
    calculateSlaDeadline,
    normalizeComplaintSeverity,
    resolveAcknowledgementHours,
    type ComplaintSeverity,
    type SlaConfiguration,
} from '@/lib/sla-deadline'
import {
    classifyComplaintSeverity,
    compareComplaintSeverity,
    COMPLAINT_SEVERITY_VALUES,
    isHigherSeverity,
    maxComplaintSeverity,
    TRIAGE_CARE_CONTEXT_VALUES,
    TRIAGE_CATEGORY_VALUES,
    TRIAGE_IMPACT_VALUES,
    type ComplaintTriageInput,
} from '@/lib/complaint-severity'

// ── readComplaintPHI ──────────────────────────────────────────────────────────

const readPhiSchema = z.object({
    complaintId: z.string().uuid("Invalid complaint ID format")
})

function decodeByteaCiphertext(value: string): Buffer {
    const normalized = value.startsWith('\\x') ? value.slice(2) : value
    if (/^[0-9a-f]+$/i.test(normalized)) {
        return Buffer.from(normalized, 'hex')
    }
    return Buffer.from(value, 'base64')
}

function decryptPhiValue(value: string, key: Buffer): string {
    const packedBuffer = decodeByteaCiphertext(value)
    if (packedBuffer.length < 29) {
        throw new Error('Invalid PHI ciphertext payload.')
    }

    const ivBuffer = packedBuffer.subarray(0, 12)
    const encryptedBuffer = packedBuffer.subarray(12)
    const authTag = encryptedBuffer.subarray(encryptedBuffer.length - 16)
    const ciphertext = encryptedBuffer.subarray(0, encryptedBuffer.length - 16)

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, ivBuffer)
    decipher.setAuthTag(authTag)

    return Buffer.concat([
        decipher.update(ciphertext),
        decipher.final()
    ]).toString('utf8')
}

export async function readComplaintPHI(input: z.infer<typeof readPhiSchema>) {
    // 1. Validate input strictly
    const parsed = readPhiSchema.safeParse(input)
    if (!parsed.success) {
        return { success: false, error: parsed.error.message }
    }
    const { complaintId } = parsed.data

    // 2. Auth guard — session + is_active check (replaces 12-line raw boilerplate)
    let user
    try {
        user = await requireUser()
    } catch (error) {
        if (error instanceof AuthError) {
            return { success: false, error: error.message }
        }
        return { success: false, error: 'Unauthorized access' }
    }

    const supabaseAdmin = createAdminClient()

    const { data: complaint, error: complaintError } = await supabaseAdmin
        .from('complaints')
        .select('id, hospital_id, department_id, deleted_at')
        .eq('id', complaintId)
        .maybeSingle()

    if (complaintError || !complaint || complaint.deleted_at) {
        return { success: false, error: "Complaint not found or access denied" }
    }

    const isHospitalScopedReviewer =
        user.role === 'quality_coordinator' &&
        !!user.hospitalId &&
        complaint.hospital_id === user.hospitalId

    const isDepartmentScopedReviewer =
        user.role === 'department_manager' &&
        !!user.hospitalId &&
        !!user.activeDepartmentId &&
        complaint.hospital_id === user.hospitalId &&
        complaint.department_id === user.activeDepartmentId

    if (!isHospitalScopedReviewer && !isDepartmentScopedReviewer) {
        return { success: false, error: "PHI access denied for this complaint scope" }
    }

    // 3. RLS Protected Fetch
    // The 'complaint_phi' policy strictly requires department matching against the parent 'complaints' row.
    // We fetch the BYTEA columns (Supabase JS returns them as Hex strings by default, e.g., "\x0123...")
    // [B.2.4] Also select key_version to dispatch to the correct master key on rotation
    const { data: phiRecord, error: fetchError } = await supabaseAdmin
        .from('complaint_phi')
        .select('description, reporter_name, reporter_contact, key_version')
        .eq('complaint_id', complaintId)
        .single()

    if (fetchError || !phiRecord) {
        return { success: false, error: "PHI not found or access denied by RLS" }
    }

    // 4. Decrypt via Application-Level Encryption (AES-256-GCM)
    // [B.2.4] Key version guard — only version 1 is active in V1.
    //   On key rotation: add version 2 key to env, extend this switch, run re-encryption job.
    if (phiRecord.key_version !== 1) {
        return { success: false, error: `Unsupported key version: ${phiRecord.key_version}. Re-encryption required.` }
    }

    try {
        const decryptStart = performance.now();

        const masterKeyBase64 = process.env.LOCAL_DEV_AES_GCM_KEY!
        const key = Buffer.from(masterKeyBase64, 'base64')

        const decryptedPhi = {
            description: decryptPhiValue(phiRecord.description, key),
            reporterName: decryptPhiValue(phiRecord.reporter_name, key),
            reporterContact: decryptPhiValue(phiRecord.reporter_contact, key),
        }

        const decryptLatency = performance.now() - decryptStart;
        decryptionLatencyHistogram.record(decryptLatency);

        // 5a. Local audit log — service-role client, RLS bypass acceptable for audit writes.
        // Cookie stubs are INTENTIONALLY no-ops: audit writes are server-initiated and have
        // no browser cookie context. Service-role key is passed directly as the JWT.
        // See createComplaint() for full rationale on the legacy stub shape.
        await supabaseAdmin.from('local_audit_reads').insert({
            actor_id: user.id,
            department_id: user.activeDepartmentId ?? complaint.department_id,
            complaint_id: complaintId
        })

        // 5b. PHI audit is durably recorded in local_audit_reads (above).
        //     SigNoz OTLP forwarding removed — SigNoz container no longer in stack.

        // 6. Return Plain Text
        return { success: true, data: decryptedPhi }
    } catch (error: unknown) {
        serverActionErrorCounter.add(1, { action: 'readComplaintPHI' });
        Sentry.captureException(error);
        return { success: false, error: "Decryption failed or data corrupted" }
    }
}

// ── createComplaint ───────────────────────────────────────────────────────────

import { rateLimitComplaintCreation } from '@/lib/rate-limit'
import { inngest } from '@/inngest/client'

// UUID-like regex — accepts any 8-4-4-4-12 hex pattern (version/variant agnostic).
// Zod's built-in .uuid() enforces RFC 4122 version bits which rejects valid demo/seed UUIDs.
const UUID_LIKE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type DepartmentRow = {
    id: string
    name: string
    escalation_level: number
}

function scoreAnonymousIntakeDepartment(name: string): number {
    const normalized = name.trim().toLowerCase()
    if (normalized === 'quality & patient safety') return 100
    if (normalized === 'quality and patient safety') return 100
    if (normalized === 'patient safety') return 95
    if (normalized === 'quality coordinator') return 90
    if (normalized === 'quality_coordinator') return 90
    if (normalized === 'quality') return 85
    if (normalized.includes('patient safety')) return 80
    if (normalized.includes('quality')) return 75
    if (normalized.includes('grievance')) return 65
    if (normalized.includes('feedback')) return 55
    return 0
}

async function resolveComplaintDepartmentId(
    supabase: ReturnType<typeof createAdminClient>,
    hospitalId: string,
    requestedDepartmentId?: string
) {
    if (requestedDepartmentId) {
        const { data: requestedDepartment, error: requestedDepartmentError } = await supabase
            .from('departments')
            .select('id')
            .eq('id', requestedDepartmentId)
            .eq('hospital_id', hospitalId)
            .is('deleted_at', null)
            .maybeSingle()

        if (requestedDepartmentError) {
            logger.warn('[createComplaint] Department validation lookup failed.', {
                hospitalId,
                departmentId: requestedDepartmentId,
                error: requestedDepartmentError.message,
            })
        } else if (requestedDepartment) {
            return { departmentId: requestedDepartment.id }
        }

        logger.warn('[createComplaint] Requested department is out of scope; falling back to hospital intake routing.', {
            hospitalId,
            departmentId: requestedDepartmentId,
        })
    }

    const { data: hospitalDepartments, error: hospitalDepartmentsError } = await supabase
        .from('departments')
        .select('id, name, escalation_level')
        .eq('hospital_id', hospitalId)
        .is('deleted_at', null)

    if (hospitalDepartmentsError) {
        logger.error('[createComplaint] Hospital department lookup failed.', {
            hospitalId,
            error: hospitalDepartmentsError.message,
        })
        return { error: 'Failed to resolve intake routing for this hospital.' }
    }

    if (!hospitalDepartments || hospitalDepartments.length === 0) {
        return { error: 'This hospital has no active departments configured for intake routing.' }
    }

    const rankedDepartments = [...hospitalDepartments as DepartmentRow[]].sort((a, b) => {
        const scoreDelta = scoreAnonymousIntakeDepartment(b.name) - scoreAnonymousIntakeDepartment(a.name)
        if (scoreDelta !== 0) return scoreDelta

        const escalationDelta = b.escalation_level - a.escalation_level
        if (escalationDelta !== 0) return escalationDelta

        return a.name.localeCompare(b.name)
    })

    const selectedDepartment = rankedDepartments[0]
    if (scoreAnonymousIntakeDepartment(selectedDepartment.name) <= 0) {
        logger.warn('[createComplaint] No obvious anonymous intake department found for hospital.', {
            hospitalId,
            candidateDepartments: rankedDepartments.map((department) => ({
                id: department.id,
                name: department.name,
                escalationLevel: department.escalation_level,
            })),
        })
        return { error: 'This hospital is missing a dedicated patient intake routing department.' }
    }

    return { departmentId: selectedDepartment.id }
}

function encryptPhiValue(value: string, key: Buffer): string {
    const iv = crypto.randomBytes(12)
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
    const authTag = cipher.getAuthTag()
    const packedPayload = Buffer.concat([iv, encrypted, authTag])
    return '\\x' + packedPayload.toString('hex')
}

function buildPatientContactHash(hospitalId: string, normalizedReporterContact: string): string {
    return crypto
        .createHash('sha256')
        .update(`patient:${hospitalId}:${normalizedReporterContact}`)
        .digest('hex')
}

const PATIENT_CONSENT_VERSION = 'v2.1-DPDP-2023'

async function cleanupPartialComplaint(
    supabase: ReturnType<typeof createAdminClient>,
    complaintId: string
) {
    const { error: consentDeleteError } = await supabase
        .from('patient_consents')
        .delete()
        .eq('complaint_id', complaintId)

    if (consentDeleteError) {
        logger.warn('[createComplaint] Consent cleanup failed after downstream error.', {
            complaintId,
            error: consentDeleteError.message,
        })
    }

    const { error: phiDeleteError } = await supabase
        .from('complaint_phi')
        .delete()
        .eq('complaint_id', complaintId)

    if (phiDeleteError) {
        logger.warn('[createComplaint] PHI cleanup failed after downstream error.', {
            complaintId,
            error: phiDeleteError.message,
        })
    }

    const { error: complaintDeleteError } = await supabase
        .from('complaints')
        .delete()
        .eq('id', complaintId)

    if (complaintDeleteError) {
        logger.warn('[createComplaint] Complaint cleanup failed after downstream error.', {
            complaintId,
            error: complaintDeleteError.message,
        })
    }
}

async function resolvePatientIdentity(
    supabase: ReturnType<typeof createAdminClient>,
    hospitalId: string,
    contactHash: string
) {
    const { data: patient, error } = await supabase
        .from('patients')
        .upsert(
            {
                hospital_id: hospitalId,
                contact_hash: contactHash,
                last_seen_at: new Date().toISOString(),
            },
            {
                onConflict: 'hospital_id,contact_hash',
                ignoreDuplicates: false,
            }
        )
        .select('id')
        .single()

    if (error || !patient) {
        logger.error('[createComplaint] Patient identity upsert failed.', {
            hospitalId,
            error: error?.message ?? 'Unknown patient upsert error',
        })
        return { error: 'Failed to prepare patient identity.' }
    }

    return { patientId: patient.id }
}

async function resolveComplaintAcknowledgementHours(
    supabase: ReturnType<typeof createAdminClient>,
    hospitalId: string,
    departmentId: string,
    severity: ComplaintSeverity
) {
    const { data, error } = await supabase
        .from('sla_configurations')
        .select('hospital_id, department_id, severity_level, max_acknowledgement_hours')
        .eq('hospital_id', hospitalId)
        .eq('severity_level', severity)
        .is('deleted_at', null)

    if (error) {
        logger.warn('[complaints] SLA configuration lookup failed; using severity fallback.', {
            hospitalId,
            departmentId,
            severity,
            error: error.message,
        })
    }

    return resolveAcknowledgementHours((data ?? []) as SlaConfiguration[], {
        hospitalId,
        departmentId,
        severity,
    })
}

type SeverityHistorySource = 'auto_triage' | 'duplicate_auto_raise' | 'staff_override'

type ComplaintSeverityParentRow = {
    id: string
    status: string
    created_at: string
    department_id: string
    severity_level: string | null
    sla_deadline: string | null
}

async function recordSeverityHistory(
    supabase: ReturnType<typeof createAdminClient>,
    input: {
        complaintId: string
        previousSeverity: ComplaintSeverity | null
        newSeverity: ComplaintSeverity
        decisionSource: SeverityHistorySource
        reasonCodes: string[]
        changedBy?: string | null
        overrideReason?: string | null
        metadata?: Record<string, unknown>
    }
) {
    const { error } = await supabase
        .from('complaint_severity_history')
        .insert({
            complaint_id: input.complaintId,
            previous_severity: input.previousSeverity,
            new_severity: input.newSeverity,
            decision_source: input.decisionSource,
            reason_codes: input.reasonCodes,
            changed_by: input.changedBy ?? null,
            override_reason: input.overrideReason ?? null,
            metadata: input.metadata ?? {},
        })

    if (error) {
        logger.error('[complaints] Severity history insert failed.', {
            complaintId: input.complaintId,
            decisionSource: input.decisionSource,
            error: error.message,
        })
    }

    return { error }
}

function isActiveAcknowledgementStatus(status: string | null | undefined) {
    return status === 'submitted' || status === 'escalated'
}

function isUnresolvedComplaintStatus(status: string | null | undefined) {
    return status !== 'resolved' && status !== 'capa_validated' && status !== 'closed'
}

function shouldReplaceDeadline(candidateDeadline: string | null, currentDeadline: string | null) {
    if (!candidateDeadline) return false
    if (!currentDeadline) return true

    const candidateMs = Date.parse(candidateDeadline)
    const currentMs = Date.parse(currentDeadline)

    return Number.isFinite(candidateMs) &&
        (!Number.isFinite(currentMs) || candidateMs < currentMs)
}

// [A.4] Removed dedupHash field — offline CRDT deduplication is no longer part of V1.
const createPhiSchema = z.object({
    departmentId: z.string().regex(UUID_LIKE, "Invalid department ID format").optional(),
    hospitalId:   z.string().regex(UUID_LIKE, "Invalid hospital ID format"),
    description:  z.string().trim().min(5),
    reporterContact: z.string().trim().min(1, "Reporter contact is required"),
    triage: z.object({
        category: z.enum(TRIAGE_CATEGORY_VALUES),
        impact: z.enum(TRIAGE_IMPACT_VALUES).optional(),
        isOngoing: z.boolean(),
        careContext: z.enum(TRIAGE_CARE_CONTEXT_VALUES).optional().default('none'),
    }),
    consentConfirmed: z.boolean().refine((value) => value === true, {
        message: 'Consent is required under DPDP 2023.'
    }),
})

export async function createComplaint(input: z.infer<typeof createPhiSchema>) {
    // 1. Zod Input Validation
    const parsed = createPhiSchema.safeParse(input)
    if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0].message }
    }
    // [A.4] dedupHash removed from destructuring
    const { departmentId, hospitalId, description, reporterContact, triage } = parsed.data
    const severityTriage: ComplaintTriageInput = {
        category: triage.category,
        careContext: triage.careContext,
        isOngoing: triage.isOngoing,
    }
    const severityDecision = classifyComplaintSeverity({
        triage: severityTriage,
        description,
    })
    let complaintSeverity = severityDecision.severity
    const severityReasonCodes = new Set(severityDecision.reasonCodes)

    const normalizedReporterContact = normalizePatientContact(reporterContact)
    if (!normalizedReporterContact) {
        return { success: false, error: "Reporter contact must be a valid mobile number." }
    }

    const patientContactHash = buildPatientContactHash(hospitalId, normalizedReporterContact)

    // 2. Pseudonymous patient-bounded rate limiting (Token Bucket: 2/min/contact-hash)
    const rateLimitResult = await rateLimitComplaintCreation(patientContactHash)
    if (!rateLimitResult.success) {
        return { success: false, error: rateLimitResult.error }
    }

    // createComplaint uses service-role — patient is anonymous (no session cookie).
    // Cookie stubs are INTENTIONALLY no-ops: this is a server-to-server call with no
    // browser context. The old get/set/remove shape is used deliberately — @supabase/ssr@0.9.0
    // accepts it via the CookieMethodsServerDeprecated overload. No real cookie lifecycle
    // is needed here because JWTs are passed directly as the service-role key, not via cookies.
    // DO NOT replace with getAll/setAll — those require a real request/response context.
    const supabase = createAdminClient()

    const departmentResolution = await resolveComplaintDepartmentId(supabase, hospitalId, departmentId)
    if (departmentResolution.error || !departmentResolution.departmentId) {
        return { success: false, error: departmentResolution.error ?? "Invalid department context for this hospital." }
    }

    const resolvedDepartmentId = departmentResolution.departmentId

    const patientIdentity = await resolvePatientIdentity(supabase, hospitalId, patientContactHash)
    if (patientIdentity.error || !patientIdentity.patientId) {
        return { success: false, error: patientIdentity.error ?? "Failed to prepare patient identity." }
    }
    const patientId = patientIdentity.patientId

    // 3. Duplicate Merge Logic (10-Minute Window)
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    const { data: recentComplaints } = await supabase
        .from('complaints')
        .select('id, parent_complaint_id, status, created_at, department_id, severity_level, sla_deadline')
        .eq('patient_id', patientId)
        .eq('hospital_id', hospitalId)
        .gte('created_at', tenMinutesAgo)
        .order('created_at', { ascending: false });

    let parentComplaintId: string | null = null
    let parentComplaint: ComplaintSeverityParentRow | null = null

    if (recentComplaints && recentComplaints.length > 0) {
        const recentComplaint = recentComplaints[0]
        parentComplaintId = recentComplaint.parent_complaint_id || recentComplaint.id;

        const { data: parentComplaintData, error: parentComplaintError } = await supabase
            .from('complaints')
            .select('id, status, created_at, department_id, severity_level, sla_deadline')
            .eq('id', parentComplaintId)
            .maybeSingle()

        if (parentComplaintError) {
            logger.warn('[createComplaint] Duplicate parent lookup failed; merge will continue.', {
                parentComplaintId,
                error: parentComplaintError.message,
            })
        }

        if (parentComplaintData) {
            parentComplaint = parentComplaintData as ComplaintSeverityParentRow
        } else if (recentComplaint.id === parentComplaintId) {
            parentComplaint = recentComplaint as ComplaintSeverityParentRow
        }

        if (parentComplaint && isUnresolvedComplaintStatus(parentComplaint.status)) {
            const raisedSeverity = maxComplaintSeverity(complaintSeverity, 'high')
            if (raisedSeverity !== complaintSeverity) {
                complaintSeverity = raisedSeverity
                severityReasonCodes.add('repeat_unresolved_complaint')
            }
        }
    }

    const createdAt = new Date()
    const acknowledgementHours = await resolveComplaintAcknowledgementHours(
        supabase,
        hospitalId,
        resolvedDepartmentId,
        complaintSeverity
    )
    const slaDeadline = calculateSlaDeadline(createdAt, acknowledgementHours)

    // 4. Insert Primary Record
    const { data: newComplaint, error: insertError } = await supabase
        .from('complaints')
        .insert({
            patient_id: patientId,
            department_id: resolvedDepartmentId,
            hospital_id: hospitalId,
            status: parentComplaintId ? 'closed' : 'submitted',
            parent_complaint_id: parentComplaintId,
            severity_level: complaintSeverity,
            sla_deadline: slaDeadline,
            created_at: createdAt.toISOString(),
        })
        .select('id')
        .single();

    if (insertError || !newComplaint) {
        logger.error('[createComplaint] Complaint insert failed.', {
            code: insertError?.code,
            message: insertError?.message,
            details: insertError?.details,
            hospitalId,
            departmentId: resolvedDepartmentId,
        })
        return { success: false, error: "Failed to create transaction record." }
    }

    const severityHistoryResult = await recordSeverityHistory(supabase, {
        complaintId: newComplaint.id,
        previousSeverity: null,
        newSeverity: complaintSeverity,
        decisionSource: 'auto_triage',
        reasonCodes: Array.from(severityReasonCodes),
        metadata: {
            triage: severityTriage,
            parentComplaintId,
        },
    })

    if (severityHistoryResult.error) {
        await cleanupPartialComplaint(supabase, newComplaint.id)
        return { success: false, error: 'Failed to record complaint severity decision.' }
    }

    // 5. Record legal consent before any PHI is written.
    const headerStore = await headers()
    const forwardedFor = headerStore.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
    const realIp = headerStore.get('x-real-ip')?.trim() ?? null
    const cfConnectingIp = headerStore.get('cf-connecting-ip')?.trim() ?? null
    const rawIpAddress = forwardedFor || realIp || cfConnectingIp
    const consentIpAddress = rawIpAddress && isIP(rawIpAddress) ? rawIpAddress : null
    const consentUserAgent = headerStore.get('user-agent')?.slice(0, 512) ?? null

    const { error: consentInsertError } = await supabase
        .from('patient_consents')
        .insert({
            patient_id: patientId,
            complaint_id: newComplaint.id,
            consent_version: PATIENT_CONSENT_VERSION,
            ip_address: consentIpAddress,
            user_agent: consentUserAgent,
        })

    if (consentInsertError) {
        logger.error('[createComplaint] Consent insert failed.', {
            complaintId: newComplaint.id,
            patientId,
            error: consentInsertError.message,
        })
        await cleanupPartialComplaint(supabase, newComplaint.id)
        return { success: false, error: 'Failed to record patient consent.' }
    }

    // 6. Encrypt and Insert PHI (AES-256-GCM)
    try {
        const masterKeyBase64 = process.env.LOCAL_DEV_AES_GCM_KEY!
        const key = Buffer.from(masterKeyBase64, 'base64')
        const encryptedDescription = encryptPhiValue(description, key)
        const encryptedReporterName = encryptPhiValue('Anonymous Patient', key)
        const encryptedReporterContact = encryptPhiValue(reporterContact, key)

        // [B.2.3] key_version: 1 — identifies the master key used to encrypt this record.
        //   Increment on key rotation (never re-use a version number).
        const { error: phiInsertError } = await supabase.from('complaint_phi').insert({
            complaint_id: newComplaint.id,
            description: encryptedDescription,
            reporter_name: encryptedReporterName,
            reporter_contact: encryptedReporterContact,
            key_version: 1
        });

        if (phiInsertError) {
            logger.error('[createComplaint] PHI insert failed.', {
                complaintId: newComplaint.id,
                error: phiInsertError.message,
            })
            await cleanupPartialComplaint(supabase, newComplaint.id)
            return { success: false, error: "Failed to store complaint details securely." }
        }

    } catch (error: unknown) {
        logger.error('[createComplaint] Application-level encryption failed.', {
            complaintId: newComplaint.id,
            error: error instanceof Error ? error.message : String(error),
        })
        await cleanupPartialComplaint(supabase, newComplaint.id)
        return { success: false, error: "Application-Level Encryption failed." }
    }

    if (parentComplaint) {
        const parentSeverity = normalizeComplaintSeverity(parentComplaint.severity_level)

        if (isHigherSeverity(complaintSeverity, parentSeverity)) {
            const parentAcknowledgementHours = await resolveComplaintAcknowledgementHours(
                supabase,
                hospitalId,
                parentComplaint.department_id,
                complaintSeverity
            )
            const parentCandidateDeadline = calculateSlaDeadline(
                parentComplaint.created_at,
                parentAcknowledgementHours
            )
            const deadlineMovesEarlier =
                isActiveAcknowledgementStatus(parentComplaint.status) &&
                shouldReplaceDeadline(parentCandidateDeadline, parentComplaint.sla_deadline)
            const parentUpdate: {
                severity_level: ComplaintSeverity
                sla_deadline?: string
            } = {
                severity_level: complaintSeverity,
            }

            if (deadlineMovesEarlier && parentCandidateDeadline) {
                parentUpdate.sla_deadline = parentCandidateDeadline
            }

            const { error: parentUpdateError } = await supabase
                .from('complaints')
                .update(parentUpdate)
                .eq('id', parentComplaint.id)

            if (parentUpdateError) {
                logger.error('[createComplaint] Duplicate parent severity raise failed.', {
                    parentComplaintId: parentComplaint.id,
                    duplicateComplaintId: newComplaint.id,
                    error: parentUpdateError.message,
                })
                await cleanupPartialComplaint(supabase, newComplaint.id)
                return { success: false, error: 'Failed to update parent complaint severity.' }
            }

            await recordSeverityHistory(supabase, {
                complaintId: parentComplaint.id,
                previousSeverity: parentComplaint.severity_level ? parentSeverity : null,
                newSeverity: complaintSeverity,
                decisionSource: 'duplicate_auto_raise',
                reasonCodes: [...Array.from(severityReasonCodes), 'duplicate_parent_raised'],
                metadata: {
                    duplicateComplaintId: newComplaint.id,
                    deadlineMovedEarlier: deadlineMovesEarlier,
                    triage: severityTriage,
                },
            })
        }
    }

    // 7. Spawn Background SLA Task (best-effort, non-blocking)
    if (!parentComplaintId) {
        try {
            await inngest.send({
                name: "complaint/submitted",
                data: {
                    complaintId: newComplaint.id,
                    patientId,
                    clinicalSlaMinutes: acknowledgementHours * 60
                }
            });
        } catch (inngestErr: unknown) {
            logger.warn('[createComplaint] Inngest send failed; complaint creation will continue.', {
                error: inngestErr instanceof Error ? inngestErr.message : String(inngestErr),
                complaintId: newComplaint.id,
            })
        }
    }

    return {
        success: true,
        message: parentComplaintId ? "Merged as duplicate." : "Complaint created.",
        id: newComplaint.id,
        isDuplicate: !!parentComplaintId,
        severity: complaintSeverity,
    }
}

const updateSeveritySchema = z.object({
    complaintId: z.string().uuid("Invalid complaint ID format"),
    severity: z.enum(COMPLAINT_SEVERITY_VALUES),
    reason: z.string().trim().min(5, 'A reason is required.').max(500),
})

export async function updateComplaintSeverity(input: z.infer<typeof updateSeveritySchema>) {
    const parsed = updateSeveritySchema.safeParse(input)
    if (!parsed.success) {
        return { success: false, error: parsed.error.issues[0].message }
    }

    let user
    try {
        user = await requireUser()
    } catch (error) {
        if (error instanceof AuthError) {
            return { success: false, error: error.message }
        }
        return { success: false, error: 'Unauthorized' }
    }

    const { complaintId, severity: nextSeverity, reason } = parsed.data
    const supabase = createAdminClient()

    const { data: complaint, error: fetchError } = await supabase
        .from('complaints')
        .select('id, hospital_id, department_id, severity_level, created_at, sla_deadline, status, deleted_at')
        .eq('id', complaintId)
        .maybeSingle()

    if (fetchError || !complaint || complaint.deleted_at) {
        logger.warn('[updateComplaintSeverity] Complaint lookup failed.', {
            complaintId,
            error: fetchError?.message,
        })
        return { success: false, error: 'Complaint not found' }
    }

    const sameHospital = !!user.hospitalId && user.hospitalId === complaint.hospital_id
    const departmentScoped =
        user.role === 'department_manager' &&
        sameHospital &&
        !!user.activeDepartmentId &&
        user.activeDepartmentId === complaint.department_id
    const hospitalScoped =
        sameHospital &&
        (user.role === 'quality_coordinator' ||
            user.role === 'admin' ||
            user.role === 'medical_superintendent')

    if (!departmentScoped && !hospitalScoped) {
        return { success: false, error: 'You are not authorized to change this complaint severity.' }
    }

    const currentSeverity = normalizeComplaintSeverity(complaint.severity_level)
    const severityDelta = compareComplaintSeverity(nextSeverity, currentSeverity)

    if (severityDelta === 0) {
        return { success: true, currentSeverity }
    }

    const isDecrease = severityDelta < 0
    const canDecrease =
        user.role === 'quality_coordinator' ||
        user.role === 'admin' ||
        user.role === 'medical_superintendent'

    if (isDecrease && !canDecrease) {
        return {
            success: false,
            error: 'Only Quality, Medical Superintendent, or Admin can lower severity.',
        }
    }

    const update: {
        severity_level: ComplaintSeverity
        sla_deadline?: string
    } = {
        severity_level: nextSeverity,
    }

    if (!isDecrease && isActiveAcknowledgementStatus(complaint.status)) {
        const acknowledgementHours = await resolveComplaintAcknowledgementHours(
            supabase,
            complaint.hospital_id,
            complaint.department_id,
            nextSeverity
        )
        const nextDeadline = calculateSlaDeadline(complaint.created_at, acknowledgementHours)

        if (nextDeadline && shouldReplaceDeadline(nextDeadline, complaint.sla_deadline)) {
            update.sla_deadline = nextDeadline
        }
    }

    const { error: updateError } = await supabase
        .from('complaints')
        .update(update)
        .eq('id', complaintId)
        .is('deleted_at', null)

    if (updateError) {
        logger.error('[updateComplaintSeverity] Complaint update failed.', {
            complaintId,
            nextSeverity,
            error: updateError.message,
        })
        return { success: false, error: 'Failed to update complaint severity.' }
    }

    const historyResult = await recordSeverityHistory(supabase, {
        complaintId,
        previousSeverity: complaint.severity_level ? currentSeverity : null,
        newSeverity: nextSeverity,
        decisionSource: 'staff_override',
        reasonCodes: [isDecrease ? 'staff_decrease' : 'staff_increase'],
        changedBy: user.id,
        overrideReason: reason,
        metadata: {
            previousDeadline: complaint.sla_deadline,
            deadlineMovedEarlier: !!update.sla_deadline,
        },
    })

    if (historyResult.error) {
        return { success: false, error: 'Severity changed, but audit history failed to record.' }
    }

    return { success: true, currentSeverity: nextSeverity }
}

// ── Complaint workflow actions ────────────────────────────────────────────────

const resolveSchema = z.object({
    complaintId: z.string().uuid("Invalid complaint ID format")
})

export async function acknowledgeComplaint(input: z.infer<typeof resolveSchema>) {
    const parsed = resolveSchema.safeParse(input)
    if (!parsed.success) return { success: false, error: 'Invalid complaint ID' }

    try {
        await requireUser()
    } catch (error) {
        if (error instanceof AuthError) {
            return { success: false, error: error.message }
        }
        return { success: false, error: 'Unauthorized' }
    }

    const complaintId = parsed.data.complaintId
    const supabase = await createAuthenticatedClient()

    const { data: complaint, error: fetchError } = await supabase
        .from('complaints')
        .select('status')
        .eq('id', complaintId)
        .single()

    if (fetchError || !complaint) {
        logger.error('[acknowledgeComplaint] Complaint lookup failed.', {
            error: fetchError?.message,
            complaintId,
        })
        return { success: false, error: 'Complaint not found' }
    }

    const currentStatus = complaint.status as string
    if (currentStatus === 'acknowledged') {
        return { success: true, currentStatus: 'acknowledged' }
    }

    if (currentStatus !== 'submitted' && currentStatus !== 'escalated') {
        return {
            success: false,
            error: `Cannot acknowledge complaint from '${currentStatus}' status.`,
        }
    }

    const { data: updatedComplaint, error: updateError } = await supabase
        .from('complaints')
        .update({ status: 'acknowledged', updated_at: new Date().toISOString() })
        .eq('id', complaintId)
        .in('status', ['submitted', 'escalated'])
        .select('id')
        .maybeSingle()

    if (updateError) {
        logger.error('[acknowledgeComplaint] Complaint acknowledgement update failed.', {
            error: updateError.message,
            complaintId,
        })
        return { success: false, error: 'Failed to acknowledge complaint' }
    }

    if (!updatedComplaint) {
        return {
            success: false,
            error: 'Complaint status changed before acknowledgement could be saved. Please refresh and try again.',
        }
    }

    if (currentStatus === 'escalated') {
        const supabaseAdmin = createAdminClient()
        const { error: notificationError } = await supabaseAdmin
            .from('notifications')
            .update({ status: 'read', read_at: new Date().toISOString() })
            .eq('complaint_id', complaintId)
            .eq('status', 'pending')

        if (notificationError) {
            logger.warn('[acknowledgeComplaint] Pending notification cleanup failed.', {
                error: notificationError.message,
                complaintId,
            })
        }
    }

    try {
        const events: Promise<unknown>[] = [
            inngest.send({
                name: 'complaint/acknowledged',
                data: { complaintId },
            }),
        ]

        if (currentStatus === 'escalated') {
            events.push(
                inngest.send({
                    name: 'complaint/notification_read',
                    data: { complaintId },
                })
            )
        }

        await Promise.all(events)
    } catch (eventError) {
        logger.warn('[acknowledgeComplaint] Inngest follow-up failed; status is acknowledged.', {
            error: eventError instanceof Error ? eventError.message : String(eventError),
            complaintId,
        })
    }

    return { success: true, currentStatus: 'acknowledged' }
}

export async function resolveComplaint(input: z.infer<typeof resolveSchema>) {
    const parsed = resolveSchema.safeParse(input)
    if (!parsed.success) return { success: false, error: 'Invalid complaint ID' }

    // Centralized auth guard — is_active check included
    try {
        await requireUser()
    } catch (error) {
        if (error instanceof AuthError) {
            return { success: false, error: error.message }
        }
        return { success: false, error: 'Unauthorized' }
    }

    const supabase = await createAuthenticatedClient()

    const { data: complaint, error: fetchError } = await supabase
        .from('complaints')
        .select('status')
        .eq('id', parsed.data.complaintId)
        .single()

    if (fetchError || !complaint) {
        logger.error('[resolveComplaint] Complaint lookup failed.', {
            error: fetchError?.message,
            complaintId: parsed.data.complaintId,
        })
        return { success: false, error: 'Complaint not found' }
    }

    if (complaint.status === 'resolved') {
        return { success: true }
    }

    if (complaint.status !== 'investigating') {
        return {
            success: false,
            error: `Complaint must be investigating before it can be resolved. Current status: ${complaint.status}.`,
        }
    }

    const { data: updatedComplaint, error } = await supabase
        .from('complaints')
        .update({ status: 'resolved', updated_at: new Date().toISOString() })
        .eq('id', parsed.data.complaintId)
        .eq('status', 'investigating')
        .select('id')
        .maybeSingle()

    if (error) {
        logger.error('[resolveComplaint] Complaint resolution update failed.', {
            error: error.message,
            complaintId: parsed.data.complaintId,
        })
        return { success: false, error: 'Failed to resolve complaint' }
    }

    if (!updatedComplaint) {
        return {
            success: false,
            error: 'Complaint status changed before resolution could be saved. Please refresh and try again.',
        }
    }

    // Fire the resolution follow-up event for reporting/materialized-view refresh.
    try {
        await inngest.send({
            name: 'complaint/resolved',
            data: { complaintId: parsed.data.complaintId }
        })
    } catch { /* non-fatal — reporting refresh has scheduled fallbacks */ }

    return { success: true }
}
