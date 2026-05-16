# Sprint 2 Checklist

## Task 2.1: Next.js Foundation & Clinical Design System
- [ ] Initialize Next.js 14 App Router using `pnpm`
- [ ] Initialize Shadcn UI (Slate theme, CSS Variables)
- [ ] Configure Tailwind clinical HSL color palette
- [ ] Scaffold role-based directory architecture (`app/(patient)/intake`, `app/(staff)/dashboard`, `app/(admin)/settings`, `app/(dpo)/investigator`)
- [ ] Build atomic UI primitives (Severity Badges, Clinical Buttons, Input error states, Skeleton loaders)
- [ ] Configure Zustand store slices (`useAuthStore`, `useOfflineQueueStore`, `useSlaStore`)
- [ ] Set up dark mode CSS variable inversion

## Task 2.2: Authentik SAML 2.0 SSO Integration
- [ ] Ensure email/password login is enabled in Supabase GoTrue
- [ ] Deploy Authentik via Docker Compose
- [ ] Configure SAML 2.0 SP metadata in GoTrue and IdP metadata in Authentik
- [ ] Configure attribute mapping (email, department -> department_id, role_group -> app_role)
- [ ] Map Authentik groups to Antigravity roles
- [ ] Implement Offline JWT Caching using window.crypto.subtle (AES-GCM, 256-bit)

## Task 2.3: Multi-Factor Authentication Enforcement
- [ ] Enable TOTP and SMS fallback for MFA
- [ ] Force MFA for Admin, Quality Coordinator, Medical Superintendent, and Department Manager
- [ ] Log MFA challenge events to `audit_logs`

## Task 2.4: Server Action Security & Session Governance
- [ ] Implement ALE PHI Access Pattern in Server Actions for `complaint_phi`
- [ ] Define Zod schemas and implement rate limiting (100 req/min per IP)
- [ ] Implement HIPAA 30-Minute Idle Timeout for clinical dashboard routes
- [ ] Add logging for all security events to `audit_logs`
