# Walkthrough: Authentik SAML 2.0 SSO Integration with Supabase GoTrue

We successfully configured an end-to-end SAML 2.0 Single Sign-On (SSO) architecture, uniting a local self-hosted instance of Authentik with the local Supabase GoTrue authentication service.

This enables users of the Next.js frontend to click a single "Login with SSO" button, be securely redirected to Authentik for identity verification, and be authenticated inside Supabase without requiring a separate password.

## Architecture & Data Flow

1. **Frontend (Next.js)**: The `app/(auth)/login/page.tsx` invokes the Supabase js client `signInWithSSO` method.
2. **Auth Service (GoTrue)**: Generates a SAML Request signature and redirects the user to the Authentik Identity Provider UI.
3. **Identity Provider (Authentik)**: The user logs in via email/password in Authentik. Authentik generates a SAML Assertion token and POSTs it back to the Supabase ACS (Assertion Consumer Service) URL.
4. **Validation**: Supabase GoTrue validates the signature using the shared SAML configuration keys. Once validated, a Supabase user session is instantiated.

## Major Configuration Steps Completed

1. **Authentik Container Deployment**: Spun up a dedicated [authentik-compose.yml](file:///c:/Application%20V4.0/authentik-compose.yml) to run the local IdP stack (Server, Postgres, Redis) on port 9090.
2. **Automated Provider Registration**: Developed [execution/configure_authentik.py](file:///c:/Application%20V4.0/execution/configure_authentik.py) and [execution/patch_authentik_saml.py](file:///c:/Application%20V4.0/execution/patch_authentik_saml.py) to programmatically provision the `Supabase GoTrue SAML` provider and `Antigravity Supabase` application inside Authentik via REST API.
3. **SAML Signature Formatting**: Resolved a critical crash loop in the Supabase GoTrue container relating to SAML Service Provider keys.
    * We discovered GoTrue requires a strict `PKCS#1` format for its RSA private key, stripped of all PEM headers (`-----BEGIN RSA PRIVATE KEY-----`) and newlines, compressed into a single raw Base64 DER string.
    * We preserved an excellent [execution/format_saml_key.py](file:///c:/Application%20V4.0/execution/format_saml_key.py) utility script to permanently solve this formatting requirement for any future certificate rotations.
    * Injected the formatted Base64 string into `GOTRUE_SAML_PRIVATE_KEY` environment variable in [supabase/docker/docker-compose.yml](file:///c:/Application%20V4.0/supabase/docker/docker-compose.yml).
4. **API Gateway (Kong) Routing Adjustments**: Addressed a "Bad Request - ACS URL Mismatch" error caused by Supabase internal routing.
    * Modified the `API_EXTERNAL_URL` in [docker-compose.yml](file:///c:/Application%20V4.0/supabase/docker/docker-compose.yml) locally to include the `/auth/v1` Kong gateway prefix. This ensured GoTrue accurately communicated its Assertion Consumer endpoints to Authentik.

## Artifacts Generated

*   [authentik_setup_guide.md](file:///C:/Users/ARPAN/.gemini/antigravity/brain/4eba6d5a-f91c-443a-b6d2-575e4d9b972d/authentik_setup_guide.md): A permanent documentation guide detailing manual UI setup for Authentik SAML and specifically covering the Supabase Private Key Formatting quirks for future developers.
*   [execution/format_saml_key.py](file:///c:/Application%20V4.0/execution/format_saml_key.py): A Python helper utility to automatically format standard PEM files into the exact raw Base64 format GoTrue requires for SAML SSO.

## Validation Results

*   [x] The local Authentik IDP can be reached securely.
*   [x] The "Login with SSO" flow redirects from Next.js to Authentik correctly.
*   [x] After authentication, Authentik posts the SAML Assertion back to `http://localhost:8000/auth/v1/sso/saml/acs`.
*   [x] Supabase accepts the response and initializes a valid application session.
