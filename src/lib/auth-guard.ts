/**
 * auth-guard.ts — Centralized Authentication & Authorization Guard
 * Phase 2.7 — StayAssist V1 Auth Architecture (Post-Authentik)
 *
 * BREAKING CHANGES FROM PREVIOUS VERSION:
 *   1. Role is now read from public.users DB table — NOT from JWT app_metadata.
 *      Authentik SAML claims (app_metadata.app_role / app_metadata.role) are removed.
 *   2. departmentId (scalar) → activeDepartmentId + departmentIds[] (M2M array).
 *      All 6 callsites that used user.departmentId must update to:
 *        - user.activeDepartmentId  for "what is my current active dept?"
 *        - user.departmentIds       for "what depts am I allowed to see?"
 *   3. phone replaces email as the primary session identifier.
 *   4. staffType field added: 'pre_assigned' | 'float'
 *   5. authMethod field added: 'sms_otp' | 'webauthn' | 'totp'
 *
 * Guard hierarchy (unchanged):
 *   createAuthenticatedClient() → requireUser() → requireRole() → requireMfa() / requirePrivileged()
 */

import { createServerClient } from '@supabase/ssr'
import { cookies, headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase-admin'
import { isMfaEnforcementPaused, normalizeRoleName } from '@/lib/auth-utils'
import { AUTH_METHOD_COOKIE } from '@/lib/auth-session-cookies'
import type { StaffRole } from '@/lib/staff-roles'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AuthenticatedUser {
  id: string                              // public.users.id (app-level UUID)
  authUserId: string                      // auth.users.id (Supabase GoTrue UUID)
  phone: string                           // Primary login identifier (E.164)
  email?: string                          // Optional — not all staff have email
  role: StaffRole                         // Read from public.users.role (DB source of truth)
  /** All departments this user is assigned to (M2M). Use for visibility checks. */
  departmentIds: string[]
  /** The department the user is actively operating as in THIS session.
   *  Set from staff_session_context via X-Active-Dept-Id middleware header.
   *  For pre-assigned staff this equals their single assignment.
   *  NULL only if session context has not been established yet. */
  activeDepartmentId: string | null
  hospitalId: string | null
  isActive: boolean
  aal: 'aal1' | 'aal2'
  staffType: 'pre_assigned' | 'float'
  authMethod: 'sms_otp' | 'webauthn' | 'totp'
}

export class AuthError extends Error {
  constructor(
    public code: 'UNAUTHORIZED' | 'FORBIDDEN' | 'DEACTIVATED' | 'MFA_REQUIRED',
    message: string
  ) {
    super(message)
    this.name = 'AuthError'
  }
}

// ── Client Factory ────────────────────────────────────────────────────────────

/**
 * Creates a user-scoped Supabase SSR client from the incoming request cookies.
 * ALWAYS prefer this over service-role key in user-facing routes.
 */
export async function createAuthenticatedClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set({ name, value, ...options })
            )
          } catch {
            // Server Components can read cookies but cannot mutate them.
            // Route handlers and the app proxy perform the actual auth cookie writes.
          }
        },
      },
    }
  )
}

async function getVerifiedAuthUser() {
  const supabase = await createAuthenticatedClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    throw new AuthError('UNAUTHORIZED', 'No active session. Please log in.')
  }

  return { supabase, authUser: user }
}

// ── Guards ────────────────────────────────────────────────────────────────────

/**
 * requireUser()
 *
 * Asserts:
 *   1. A valid Supabase session exists and auth identity is verified with Supabase.
 *   2. The staff account is NOT soft-deactivated (is_active = true in DB).
 *   3. Role is resolved from public.users DB — NOT from JWT app_metadata.
 *   4. All active department assignments are loaded from user_department_assignments.
 *   5. Active department context is read from X-Active-Dept-Id middleware header.
 *
 * @throws {AuthError} UNAUTHORIZED  — no verified session / expired JWT
 * @throws {AuthError} DEACTIVATED   — account soft-disabled by Admin
 */
export async function requireUser(): Promise<AuthenticatedUser> {
  const { supabase, authUser } = await getVerifiedAuthUser()

  // ── 1. Load staff profile from DB (source of truth for role + hospital) ──
  // Use service-role client to bypass RLS — the verified auth identity above
  // establishes who the caller is before any privileged profile lookup occurs.
  const svcClient = createAdminClient()
  const { data: staffProfile, error: profileError } = await svcClient
    .from('users')
    .select('id, role, hospital_id, is_active, department_id')
    .eq('auth_user_id', authUser.id)
    .is('deleted_at', null)
    .single()

  if (profileError || !staffProfile || !staffProfile.id) {
    throw new AuthError('UNAUTHORIZED', 'Staff profile not found. Contact your administrator.')
  }

  if (!staffProfile.is_active) {
    throw new AuthError('DEACTIVATED', 'Account deactivated. Contact your administrator.')
  }

  // ── 2. Load all active department assignments (M2M) ───────────────────────
  // REPLACES: scalar user.app_metadata.department_id (single value)
  const { data: assignmentRows } = await supabase
    .from('user_department_assignments')
    .select('department_id, valid_until, is_active')
    .eq('user_id', staffProfile.id)

  const now = Date.now()
  const assignmentCount = assignmentRows?.length ?? 0
  const departmentIds = (assignmentRows ?? [])
    .filter((assignment) => {
      const isActive = assignment.is_active === true
      const validUntil = assignment.valid_until
        ? new Date(assignment.valid_until as string).getTime()
        : null

      return isActive && (validUntil === null || validUntil > now)
    })
    .map((assignment) => assignment.department_id as string)

  // ── 3. Resolve active department from session context header ──────────────
  // Injected by Next.js middleware from staff_session_context table.
  const headerStore = await headers()
  const requestedActiveDepartmentId = headerStore.get('x-active-dept-id')
  const validatedHeaderDepartmentId =
    requestedActiveDepartmentId && departmentIds.includes(requestedActiveDepartmentId)
      ? requestedActiveDepartmentId
      : null
  const fallbackDepartmentId =
    departmentIds.length === 1
      ? departmentIds[0]
      : assignmentCount === 0
        ? (staffProfile.department_id ?? null)
      : null
  const activeDepartmentId = validatedHeaderDepartmentId ?? fallbackDepartmentId

  // ── 4. Determine staff type ───────────────────────────────────────────────
  const staffType: 'pre_assigned' | 'float' = departmentIds.length > 1 ? 'float' : 'pre_assigned'

  // ── 5. Determine MFA assurance level ─────────────────────────────────────
  const mfaPaused = isMfaEnforcementPaused()
  const { data: aalData } = mfaPaused
    ? { data: null }
    : await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
  const aalFromSupabase = (aalData?.currentLevel ?? 'aal1') as 'aal1' | 'aal2'

  // ── 6. Resolve auth method from session cookie set by verify route ────────
  const cookieStore = await cookies()
  const authMethodCookie = cookieStore.get(AUTH_METHOD_COOKIE)?.value
  const authMethod = (authMethodCookie as AuthenticatedUser['authMethod']) ?? 'sms_otp'
  // Local pause treats MFA as satisfied without mutating Supabase's actual AAL.
  const aal = mfaPaused || authMethod === 'webauthn' ? 'aal2' : aalFromSupabase

  return {
    id: staffProfile.id,
    authUserId: authUser.id,
    phone: authUser.phone ?? '',
    email: authUser.email,
    role: staffProfile.role as StaffRole,
    departmentIds,
    activeDepartmentId,
    hospitalId: staffProfile.hospital_id,
    isActive: true,
    aal,
    staffType,
    authMethod,
  }
}

/**
 * requireRole(allowedRoles)
 *
 * Asserts: requireUser() conditions + role is in allowedRoles.
 * Role comparison is case-insensitive.
 *
 * @throws {AuthError} FORBIDDEN — role not in allowedRoles
 */
export async function requireRole(allowedRoles: string[]): Promise<AuthenticatedUser> {
  const user = await requireUser()
  const normalizedRole = normalizeRoleName(user.role)
  const normalizedAllowed = allowedRoles.map((r) => normalizeRoleName(r))

  if (!normalizedAllowed.includes(normalizedRole)) {
    throw new AuthError(
      'FORBIDDEN',
      `Role '${user.role}' is not authorized. Required: ${allowedRoles.join(', ')}`
    )
  }
  return user
}

/**
 * requireMfa()
 *
 * Asserts: requireUser() conditions + AAL2 (TOTP or WebAuthn challenge completed).
 *
 * @throws {AuthError} MFA_REQUIRED — user is aal1 only
 */
export async function requireMfa(): Promise<AuthenticatedUser> {
  const user = await requireUser()
  if (user.aal !== 'aal2') {
    throw new AuthError(
      'MFA_REQUIRED',
      'MFA challenge required for this action. Please complete verification.'
    )
  }
  return user
}

/**
 * requirePrivileged(allowedRoles)
 *
 * Asserts: requireRole() conditions + AAL2.
 * Use for PHI access gates, DPO investigator portal, admin mutations.
 *
 * @throws {AuthError} FORBIDDEN    — role mismatch
 * @throws {AuthError} MFA_REQUIRED — aal1 only
 */
export async function requirePrivileged(allowedRoles: string[]): Promise<AuthenticatedUser> {
  const user = await requireRole(allowedRoles)
  if (user.aal !== 'aal2') {
    throw new AuthError('MFA_REQUIRED', 'MFA required for privileged operations.')
  }
  return user
}
