# Sprint 2 Implementation Plan

## Goal Description
The objective of Sprint 2 is to build the frontend foundation using Next.js 14 and Shadcn UI, establish the clinical design system, and integrate robust authentication via open-source Authentik SAML 2.0 SSO, including Multi-Factor Authentication (MFA) and Application-Level Encryption (ALE) for PHI access.

## Proposed Changes

### Next.js 14 Initialization & Foundation (Task 2.1)
- **Initialize Project:** Use `pnpm create next-app` to set up Next.js 14 App Router with Tailwind CSS, TypeScript, and ESLint. Using `pnpm` will resolve the slow npm installation issues encountered previously.
- **Shadcn UI Setup:** Run `npx shadcn-ui@latest init` to initialize the UI framework with the Slate theme and CSS variables.
- **Design System Implementation:** Update `tailwind.config.ts` and `globals.css` to include the clinical HSL color palette and dark mode variables.
- **Routing & State:** Create base layout files for `app/(patient)`, `app/(staff)`, `app/(admin)`, and `app/(dpo)`. Set up `zustand` stores.

### Authentik Deployment & SSO (Task 2.2)
- **Deployment:** Create a `docker-compose.yml` for Authentik in the `supabase/docker/authentik` or a separate `authentik` directory.
- **Configuration:** Set up SAML 2.0 integration between Supabase GoTrue and Authentik. Map Authentic groups to Antigravity roles (e.g., `ANTIGRAVITY_QUALITY` to `quality_coordinator`).
- **Offline JWT Caching:** Create a utility to encrypt JWTs using Web Crypto API (`AES-GCM`) before caching them in IndexedDB.

### MFA & Session Security (Task 2.3 & 2.4)
- **MFA Enforcement:** Introduce a middleware or Higher-Order Component to enforce TOTP for staff roles accessing sensitive routes.
- **Server Actions & ALE:** Build Next.js Server Actions with strict `auth.uid()` checks and JWT claim validation before executing ALE (AES-256-GCM) decryption using the `PHI_ENCRYPTION_KEY_ID`.
- **Session Timeout:** Use a client-side idle timer or middleware to enforce the HIPAA 30-Minute idle timeout constraint.

## Verification Plan

### Automated Tests
- Build verification tests for the Next.js Server Actions to confirm that:
  - Zod validation rejects invalid inputs.
  - Role-based access control functions block unauthorized access.
  - Rate limiting correctly throttles requests.

### Manual Verification
- **Installation Verifications:** Launch `pnpm run dev` and ensure the base Next.js UI connects to the Tailwind clinical theme without errors.
- **Authentik Workflow:** Manually navigate to the login page, authenticate via Authentik SAML overlay, and verify role assignment in Supabase.
- **Offline JWT Check:** Inspect `IndexedDB` in the browser dev tools to confirm the JWT is stored as encrypted ciphertext and NOT raw Base64.
- **Idle Timeout:** Leave the dashboard idle for 30 minutes and confirm automatic logout.
