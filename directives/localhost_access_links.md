# 🌐 Antigravity Platform: Local Access Links

Here is the complete reference of all local application environments, identity provider tools, databases, and monitoring services running locally.

## 🔥 Main Application (Next.js)
| Service | URL | Description |
|---------|-----|-------------|
| **Patient Complaint Intake** | `http://localhost:3000/intake?hospital_id=[uuid]` | Public form (Requires a valid hospital QR/link context) |
| **QR Code Assets** | [http://localhost:3000/mock-qr](http://localhost:3000/mock-qr) | Generates printable QR codes for intake |
| **SSO Login Page** | [http://localhost:3000/login](http://localhost:3000/login) | Authentik SSO entry point |
| **Staff Dashboard** | [http://localhost:3000/dashboard](http://localhost:3000/dashboard) | Requires staff SAML session |

---

## 🔐 Identity Provider (Authentik)
| Service | URL | Description |
|---------|-----|-------------|
| **Authentik App Library** | [http://localhost:9090/if/user/#/library](http://localhost:9090/if/user/#/library) | App Launcher (IdP-initiated flow) |
| **Authentik Admin Panel** | [http://localhost:9090/if/admin/](http://localhost:9090/if/admin/) | Manage users, SAML configs, and roles |

---

## 🗄️ Supabase Stack (Database & API)
| Service | URL | Description |
|---------|-----|-------------|
| **Supabase Studio** | [http://localhost:8000](http://localhost:8000) | DB viewer, Logs, and Settings (Default user `supabase`) |
| **Kong API Gateway** | [http://localhost:8000](http://localhost:8000) | Internal GoTrue/PostgREST routing |
| **IdP Metadata Endpoint** | [http://localhost:8000/auth/v1/sso/saml/metadata](http://localhost:8000/auth/v1/sso/saml/metadata) | Supabase SAML metadata URL |
| **Postgres Database** | `postgres://postgres:Oq0x8ZL3pPzspv-oGxczpcXr6nWvb7Bk@localhost:5432/postgres` | Direct DB access (`POSTGRES_PASSWORD` from [.env](file:///c:/Application%20V4.0/.env)) |

---

## 📊 Observability (Logs & Traces)
| Service | URL | Description |
|---------|-----|-------------|
| **SigNoz Dashboard** | [http://localhost:3301](http://localhost:3301) | View OpenTelemetry traces and telemetry |
