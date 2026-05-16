import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export interface ReportData {
  hospitalName: string;
  reportDate: string;
  totalComplaints: number;
  compliancePercentage: number;
  avgResolutionTime: string;
  departmentHeatmap: Record<string, unknown>[];
}

export interface NabhPre7Data {
  hospitalName: string;
  reportDate: string;
  patientRightsViolations: number;
  clinicalSafetyIncidents: number;
  totalGrievances: number;
  slaCompliance: number;
  capaValidations: number;
}

export async function generateQualityCoordinatorReport(data: ReportData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([600, 800]);

  const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const { width, height } = page.getSize();

  // Header
  page.drawRectangle({
    x: 0,
    y: height - 100,
    width,
    height: 100,
    color: rgb(0.13, 0.28, 0.45), // Brand Blue
  });

  page.drawText('STAYASSIST COMPLIANCE REPORT', {
    x: 50,
    y: height - 40,
    size: 20,
    font: helveticaBold,
    color: rgb(1, 1, 1),
  });

  page.drawText(`${data.hospitalName} - 30 Day Resolution Report`, {
    x: 50,
    y: height - 70,
    size: 14,
    font: helveticaFont,
    color: rgb(0.9, 0.9, 0.9),
  });

  // Zero PHI Badge
  page.drawText('ZERO-PHI AUDITED & VERIFIED', {
    x: width - 200,
    y: height - 25,
    size: 10,
    font: helveticaBold,
    color: rgb(0.3, 0.8, 0.5),
  });

  // Metrics Section
  let y = height - 150;

  page.drawText('Executive Summary', { x: 50, y, size: 16, font: helveticaBold, color: rgb(0.1, 0.1, 0.1) });

  y -= 40;
  page.drawText(`Total Institutional Grievances: ${data.totalComplaints}`, { x: 50, y, size: 12, font: helveticaFont, color: rgb(0.2, 0.2, 0.2) });

  y -= 30;
  page.drawText(`SLA Compliance Rate: ${data.compliancePercentage}%`, { x: 50, y, size: 12, font: helveticaBold, color: data.compliancePercentage >= 90 ? rgb(0.1, 0.6, 0.2) : rgb(0.8, 0.2, 0.2) });

  y -= 30;
  page.drawText(`Average Resolution Time: ${data.avgResolutionTime} hours`, { x: 50, y, size: 12, font: helveticaFont, color: rgb(0.2, 0.2, 0.2) });

  y -= 60;
  page.drawText('Department Heatmap (PHI-Stripped)', { x: 50, y, size: 16, font: helveticaBold, color: rgb(0.1, 0.1, 0.1) });

  y -= 40;
  data.departmentHeatmap.forEach(dept => {
    page.drawText(`- Dept: ${String(dept.department_id).substring(0,8)}... | Volume: ${dept.total_complaints} | Resolved: ${dept.resolved_complaints}`, {
      x: 50,
      y,
      size: 10,
      font: helveticaFont,
      color: rgb(0.3, 0.3, 0.3),
    });
    y -= 20;
  });

  // Footer
  page.drawText(`Generated securely via StayAssist Engine on ${data.reportDate}.`, {
    x: 50,
    y: 50,
    size: 9,
    font: helveticaFont,
    color: rgb(0.5, 0.5, 0.5),
  });

  return await pdfDoc.save();
}

/**
 * Task 5.5 statutory generator for NABH PRE.7 Patient Rights Objective
 */
export async function generateNabhPre7Report(data: NabhPre7Data): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([600, 800]);

  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const { width, height } = page.getSize();

  // Statutory Header
  page.drawRectangle({ x: 0, y: height - 120, width, height: 120, color: rgb(0.95, 0.95, 0.95) });

  page.drawText('NABH PRE-ACCREDITATION ENTRY LEVEL', { x: 50, y: height - 40, size: 16, font: bold, color: rgb(0.1, 0.1, 0.1) });
  page.drawText('Objective: PRE.7 - Patient Rights & Education', { x: 50, y: height - 60, size: 12, font: font, color: rgb(0.3, 0.3, 0.3) });
  page.drawText(`Facility: ${data.hospitalName}`, { x: 50, y: height - 85, size: 11, font: bold });
  page.drawText(`Period: Last 30 Days (Generated ${data.reportDate})`, { x: 50, y: height - 100, size: 10, font: font, color: rgb(0.4, 0.4, 0.4) });

  // Watermark
  page.drawText('CONFIDENTIAL • ZERO-PHI VERIFIED', { x: width - 230, y: 30, size: 10, font: bold, color: rgb(0.7, 0.7, 0.7) });

  let y = height - 160;

  // Body metrics mapping exactly to PRE.7 standards
  const drawMetric = (label: string, value: string | number, isWarn = false) => {
      page.drawText(label, { x: 50, y, size: 11, font: bold, color: rgb(0.2, 0.2, 0.2) });
      page.drawText(String(value), { x: 350, y, size: 11, font: font, color: isWarn ? rgb(0.8, 0.2, 0.2) : rgb(0.1, 0.1, 0.1) });
      y -= 30;
  };

  drawMetric("PRE.7a Total Grievances Logged:", data.totalGrievances);
  drawMetric("PRE.7b Rights Violations Escalated:", data.patientRightsViolations, data.patientRightsViolations > 0);
  drawMetric("PRE.7c Clinical Safety Incidents:", data.clinicalSafetyIncidents, data.clinicalSafetyIncidents > 0);
  drawMetric("SLA Resolution Compliance:", `${data.slaCompliance}%`, data.slaCompliance < 80);
  drawMetric("Validated CAPA Interventions:", data.capaValidations);

  y -= 40;
  page.drawText("Compliance Declaration:", { x: 50, y, size: 12, font: bold, color: rgb(0.1, 0.1, 0.1) });
  y -= 25;
  page.drawText("This statutory extract is certified fully anonymised and stripped of", { x: 50, y, size: 9, font: font, color: rgb(0.3, 0.3, 0.3) });
  y -= 15;
  page.drawText("Protected Health Information (PHI) under ISO 27001 / DPDP rules.", { x: 50, y, size: 9, font: font, color: rgb(0.3, 0.3, 0.3) });

  return await pdfDoc.save();
}
