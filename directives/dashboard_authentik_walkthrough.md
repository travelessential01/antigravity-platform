# Authentik SSO Dashboard Login Walkthrough

This guide details the end-to-end flow for authenticating into the Antigravity v4.0 Dashboard using our local Authentik IdP via SAML 2.0.

## 1. Prerequisites
Ensure all required infrastructure is running:
* **Next.js Frontend**: running on `http://localhost:3000` (via `npm run dev`)
* **Supabase (+ GoTrue)**: running on `http://localhost:8000` (via `supabase start`)
* **Authentik Server**: running on `http://localhost:9090` (via `docker compose -f authentik-compose.yml up`)

## 2. Initiating the Login Flow
1. Open your browser and navigate to the application login page: `http://localhost:3000/login`
2. You will see a button labeled **"Login with SSO (Authentik)"**.
3. Clicking this button triggers `supabase.auth.signInWithSSO()`, passing our specific Authentik SAML Provider ID.
4. Supabase GoTrue will initiate a SAML AuthN Request and redirect your browser to the Authentik login portal.

## 3. Authenticating with Authentik
1. Your browser will be redirected to the Authentik authorization endpoint (e.g., `http://localhost:9090/application/saml/antigravity-supabase/sso/binding/redirect/`).
2. **If you are not already logged into Authentik**, you will be prompted for your username and password.
   *(Use one of the test user accounts created during the Authentik setup, such as a Quality Coordinator or Department Manager).*
3. **If MFA is enabled** inside Authentik for this user/group, you will be prompted to complete the secondary challenge (e.g., TOTP).
4. Upon successful authentication, Authentik generates a signed SAML Assertion containing:
   * The user's email identifying them.
   * Injected custom SAML Attributes: `app_role` (mapped from Authentik groups like `ANTIGRAVITY_QUALITY`) and `department_id`.
5. Authentik POSTs this secure assertion back to the Supabase GoTrue ACS (Assertion Consumer Service) URL.

## 4. Supabase Session Creation & Redirection
1. Supabase GoTrue verifies the SAML Assertion signature against the configured Authentik X.509 certificate.
2. If valid, GoTrue parses the attributes, maps `app_role` and `department_id` into the user's `app_metadata`, and issues a Supabase JWT.
3. Supabase then redirects your browser back to the Next.js frontend at the configured callback URL: `http://localhost:3000/auth/callback`.

## 5. Next.js Middleware & Dashboard Access
1. The `/auth/callback` route exchanges the auth code for a session and sets the Supabase cookies.
2. The browser is then redirected to `http://localhost:3000/dashboard`.
3. The Next.js `middleware.ts` intercepts this request, verifies the session cookies, and checks the `app_role` inside the JWT payload.
4. **MFA Enforcement (AAL2)**: If the user's role is clinical/administrative (e.g., `Admin`, `Quality Coordinator`), the middleware queries Supabase to check the current Assurance Level (`aal`). If it is only `aal1`, the middleware redirects the user to the Supabase MFA challenge flow (`/auth/mfa/challenge`) to complete TOTP verification at the Supabase layer.
5. Once AAL2 is achieved (or if no MFA is required), you are granted access and the dashboard renders.

## 6. Access Control & Row Level Security (RLS)
Inside the dashboard:
* **Department Managers** will only see complaints where `department_id` matches their JWT claim.
* **Admins / Quality Coordinators** will see all complaints across their hospital.
* **Zero PHI** is exposed by default. Access to the decrypted payload requires interacting with the specific complaint row and passing the Application-Level Encryption (ALE) checks.
