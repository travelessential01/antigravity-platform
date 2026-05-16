'use server'

/**
 * sla.ts - SLA Configuration Server Action
 * Sprint A.2 + A.3 Refactor
 *
 * CHANGES FROM PRE-SPRINT:
 *   [A.2] Replaced raw getSession() + manual role check with requirePrivileged(['Admin'])
 *         from auth-guard.ts. Role check is now case-insensitive and includes MFA/AAL2.
 *   [A.3] Removed @opentelemetry/api import and OTEL meter/counter setup.
 *         Replaced errorCounter with no-op stub from telemetry.ts.
 */

import { z } from 'zod'
import * as Sentry from '@sentry/nextjs'
import { inngest } from '@/inngest/client'
import { logger } from '@/lib/logger'
import { AuthError, requirePrivileged } from '@/lib/auth-guard'
import { createAdminClient } from '@/lib/supabase-admin'
import { serverActionErrorCounter } from '@/lib/telemetry'
import { DEFAULT_COMPLAINT_SEVERITY } from '@/lib/sla-deadline'

const slaConfigSchema = z.object({
  ackHours: z.number().int().min(1).max(24, 'NABH limit: acknowledgement must be <= 24 hours'),
  resHours: z.number().int().min(1).max(720, 'NABH limit: resolution must be <= 720 hours'),
  hospitalId: z.string().uuid('Invalid hospital ID').optional(),
})

export async function updateSlaConfig(input: z.infer<typeof slaConfigSchema>) {
  const parsed = slaConfigSchema.safeParse(input)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message }
  }

  const { ackHours, resHours, hospitalId } = parsed.data

  let user
  try {
    user = await requirePrivileged(['Admin'])
  } catch (error) {
    if (error instanceof AuthError) {
      serverActionErrorCounter.add(1, { action: 'updateSlaConfig', reason: error.code })
      return { success: false, error: error.message }
    }

    return { success: false, error: 'Unauthorized' }
  }

  const supabaseAdmin = createAdminClient()
  const targetHospitalId = hospitalId ?? user.hospitalId

  if (!targetHospitalId) {
    logger.warn('SLA configuration update rejected due to missing hospital scope.', {
      requestedHospitalId: hospitalId ?? null,
      updatedBy: user.id,
    })
    return { success: false, error: 'No hospital scope is attached to this admin account.' }
  }

  if (hospitalId && user.hospitalId && hospitalId !== user.hospitalId) {
    logger.warn('SLA configuration update rejected due to cross-hospital scope.', {
      requestedHospitalId: hospitalId,
      actorHospitalId: user.hospitalId,
      updatedBy: user.id,
    })
    return { success: false, error: 'You cannot update SLA settings for another hospital.' }
  }

  const update = {
    max_acknowledgement_hours: ackHours,
    max_resolution_hours: resHours,
    updated_at: new Date().toISOString(),
  }

  const { data: existingConfigs, error: lookupError } = await supabaseAdmin
    .from('sla_configurations')
    .select('id')
    .eq('hospital_id', targetHospitalId)
    .eq('severity_level', DEFAULT_COMPLAINT_SEVERITY)
    .is('department_id', null)
    .is('deleted_at', null)
    .limit(1)

  if (lookupError) {
    logger.error('SLA configuration lookup failed.', {
      error: lookupError.message,
      hospitalId: targetHospitalId,
      updatedBy: user.id,
    })
    serverActionErrorCounter.add(1, { action: 'updateSlaConfig', reason: 'DatabaseError' })
    Sentry.captureException(lookupError)
    return { success: false, error: 'Database update failed' }
  }

  const existingConfigId = existingConfigs?.[0]?.id
  const mutation = existingConfigId
    ? supabaseAdmin
        .from('sla_configurations')
        .update(update)
        .eq('hospital_id', targetHospitalId)
        .eq('severity_level', DEFAULT_COMPLAINT_SEVERITY)
        .is('department_id', null)
        .is('deleted_at', null)
    : supabaseAdmin
        .from('sla_configurations')
        .insert({
          hospital_id: targetHospitalId,
          department_id: null,
          severity_level: DEFAULT_COMPLAINT_SEVERITY,
          ...update,
        })

  const { error: mutationError } = await mutation

  if (mutationError) {
    logger.error('SLA configuration update failed.', {
      error: mutationError.message,
      hospitalId: targetHospitalId,
      updatedBy: user.id,
    })
    serverActionErrorCounter.add(1, { action: 'updateSlaConfig', reason: 'DatabaseError' })
    Sentry.captureException(mutationError)
    return { success: false, error: 'Database update failed' }
  }

  await inngest.send({
    name: 'sla/config-updated',
    data: {
      ackHours,
      resHours,
      hospitalId: targetHospitalId,
      updatedBy: user.id,
    },
  })

  return { success: true }
}
