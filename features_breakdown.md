# Application Features Breakdown

This document categorizes the application's features into three tiers: from the absolute minimum required to launch, up to the highly specialized, luxury capabilities.

## 1. Basic / Core Features (The MVP)
*These must exist for the application to serve its foundational purpose. If you launch without these, the product is broken.*

*   **QR Code Generation & Routing (`/mock-qr`, `api/qr`)**: Generating the codes that embed the `hospital_id` so patients are routed to the correct intake form.
*   **Patient Intake Form (`/patient/intake`)**: The public-facing form where respondents can securely submit their feedback or complaints.
*   **Secure Supabase Storage**: The database tables (`complaints` and `complaint_phi`) that capture and securely store the submitted data.
*   **Basic Authentication (SSO)**: A secure login gate keeping public users out of the staff areas.
*   **Standard Staff Dashboard (`/staff/dashboard`)**: A simple, centralized list view where authenticated staff can read incoming complaints.

***

## 2. Good to Have (The "V2" Enhancements)
*These features significantly improve the user experience and operational efficiency, but the core system still works if they are temporarily broken or delayed.*

*   **Basic Triage Workflow**: The ability for staff to update the status of complaints (e.g., *New → In Review → Resolved*) instead of just viewing a read-only list.
*   **Single-Department Assignment**: Routing specific complaints only to the staff members assigned to that particular department, keeping their dashboards clean.
*   **Admin FAQ Management System (`/admin/faq-management`)**: A CMS for administrators to dynamically read, write, and update the FAQs without needing to push code.
*   **Basic Reporting / Exports**: The ability for the hospital to export the complaint data to a CSV or Excel file for their own offline review.

***

## 3. Luxury / Bespoke (Enterprise & Compliance)
*These are complex, highly specialized features designed for massive scale, edge cases, strict legal compliance (like JCI/NABH accreditation), or perfect user experience.*

*   **Multi-Department "Float Staff" Context Switching**: Building complex UI and audit-logged re-authentication flows (MFA) specifically for staff members who float between different departments during their shift.
*   **Dedicated Investigator/DPO Workflows (`/dpo/investigator`)**: Specialized interfaces for Data Protection Officers to conduct deep root-cause analyses, attach evidence, and track compliance metrics.
*   **Offline Queue Synchronization**: Complex frontend logic (Service Workers) that allows patients to submit forms even with zero internet connectivity, storing the data locally on their phone and automatically syncing it to the database once they come back online.
*   **Advanced Observability Pipelines**: Setting up complex telemetry, build monitoring, and automated alerts to prepare for "Mock Surveyor Audits" and ensure 99.99% uptime visibility.
