# Task 5.5: Accreditation Report Generator

**Owner:** Compliance Engineer
**Risk:** MEDIUM

## Objective
Create an on-demand generator for statutory accreditation reports required for NABH and JCI audits.

## Implementation Steps
1. **Report Generation Service**:
   - Build server-side logic to generate the following reports in both PDF and CSV formats:
     - **NABH PRE.7 Summary**
     - **24-Hour Compliance Report**
     - **SLA Breach Summary**
     - **Annual Grievance Export**

2. **Data Aggregation**:
   - Source data exclusively from the materialised views created in Task 5.1 and the `audit_logs`.

3. **PHI Validation Pipeline**:
   - Implement strict SAST scanning / static checks to guarantee no PHI columns are queried during the generation of these reports.
   - Provide visual assurance (e.g., a "Zero-PHI Verified" watermark) on generated documents.

## Deliverable
- All 4 report types generated and verified zero-PHI.
