 # Task 5.2: B2B Transparency Widgets & Marketing Integration

**Owner:** Frontend Architect
**Risk:** MEDIUM

## Objective
Develop embeddable widgets and downloadable reports that surface SLA compliance metrics for external marketing and B2B transparency.

## Implementation Steps
1. **SSR Transparency Widget**:
   - Create an SEO-optimised Next.js Server Component that reads from `mv_sla_compliance_percentage`.
   - Design an embeddable `<script>` or `iframe` tailored for external hospital websites (e.g., LinkedIn, Google Business).

2. **Quality Coordinator PDF Export**:
   - Build a server-side PDF generation utility (e.g., using `puppeteer` or `pdfmake`).
   - Generate a 30-day resolution report that is hospital-branded and strictly PHI-stripped.
   - Add a download button on the Quality Coordinator dashboard.

3. **Organisation Dashboard**:
   - Develop a Bento grid layout for the `Admin`/`Medical Superintendent` view.
   - Display cross-facility SLA compliance metrics.
   - Implement drill-down navigation from the Org level to specific hospital levels.

## Deliverable
- Working embedded widget + PDF export with PHI-zero audit proof.
