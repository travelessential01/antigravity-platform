# Antigravity Phase 0: Non-Automatable & Partially Automatable Prerequisites

This document outlines the mandatory Human-in-the-Loop (HITL) procedures required before Sprint 1 development and production deployment can begin.

## 🔴 Non-Automatable (Mandatory Human Action)

These tasks involve government regulations, high-level enterprise security, or financial billing. They **must** be completed manually by authorized personnel.

### 1. TRAI/DLT Template Approval & MSG91/Twilio (India Telecom Regulation)
*   **Why:** Indian law (TRAI) mandates that all commercial SMS traffic goes over Distributed Ledger Technology (DLT). You cannot send SMS without registered templates.
*   **TESTING ENVIRONMENT EXCEPTION (Sprints 1-7):** During all local development and testing phases, the SMS/OTP verification step will be **completely bypassed**. We will configure the backend to accept any OTP (e.g., `123456`) or automatically verify the session without relying on actual SMS gateways until production deployment.
*   **Who:** Hospital Administrator / Legal Authorized Signatory (For Production Only).
*   **Action Steps (Before Production):**
    1.  Register the Hospital Entity on a DLT portal (e.g., Jio, Airtel, Vodafone Idea, or BSNL).
    2.  Register Header/Sender IDs (e.g., `HOSPIT`, `ANTIGV`).
    3.  Register precise SMS Content Templates. 
        *   *Example Template:* `Dear {#var#}, your grievance ID {#var#} has been registered. View details: {#var#} - Hospital Name`
    4.  Obtain the **DLT Template IDs** for each approved template.
*   **Handoff:** Provide these DLT Template IDs to the Development Team (Agent 7 - DevOps) to embed in the MSG91/Twilio payload during production deployment.

### 2. Hospital Active Directory Export (Pre-Task 2.2)
*   **Why:** Antigravity uses SAML 2.0 Identity Providers (Authentik/Keycloak) to map existing hospital staff to application roles (e.g., mapping the "Quality Dept" to the `quality_coordinator` role).
*   **Who:** Hospital IT / Active Directory Administrator.
*   **Action Steps:**
    1.  Export a CSV from Microsoft Entra ID (Azure AD), Windows Server AD, or Google Workspace.
    2.  Required columns: `User Principal Name (UPN) / Email`, `Department`, `Object ID`.
*   **Handoff:** Provide this CSV to the Development Team (Agent 3 - Security) for IdP group mapping.

### 3. AWS Root Account Creation & Billing (ap-south-1)
*   **Why:** To comply with the Digital Personal Data Protection (DPDP) Act 2023, all data must physically reside in India (`ap-south-1` Mumbai).
*   **Who:** Project Sponsor / Financial Controller.
*   **Action Steps:**
    1.  Create an AWS Account.
    2.  Attach a valid corporate credit card/billing method.
    3.  Ensure the `ap-south-1` region is enabled and not restricted by account guardrails.

---

## 🟡 Partially Automatable (Requires User to Provide Root Keys)

The development team (Agents) can write Terraform/AWS CLI scripts to automate these setups, **BUT** you must explicitly provide the required API keys and access tokens first.

### 1. AWS IAM & Cloud Provisioning
*   **Why:** We must build the production EC2 instances, the WAL-G S3 bucket, and set up the AWS Key Management Service (KMS) for AES-256-GCM encryption.
*   **What You Must Provide:** An **AWS IAM Access Key ID** and **Secret Access Key** with `AdministratorAccess` (or highly scoped permissions for EC2, S3, KMS, and VPC).
*   **Agent Action:** Once provided, the agents will execute an Infrastructure as Code (IaC) script to spin up the Mumbai infrastructure automatically.

### 2. APM & SMS Integration Keys
*   **Why:** For monitoring SLA queues, detecting ledger tampering, and sending escalation SMS messages.
*   **What You Must Provide:**
    *   **PagerDuty Integration Key:** (For the Supabase webhook to trigger tamper alerts).
    *   **SigNoz API Token:** (If using SigNoz cloud instead of self-hosting it).
    *   **MSG91 / Twilio API Keys:** (For SMS gateway routing).
*   **Agent Action:** Once provided, the agents will inject these into the `.env` configuration payload and test the webhooks.
