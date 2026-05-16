import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, rgb } from "pdf-lib";
import { requireApiPrivileged } from "@/lib/api-auth";
import { getElasticsearchClient } from "@/lib/elasticsearch";
import { logger } from "@/lib/logger";
import { formatAppTimestamp } from "@/lib/app-time";

interface AuditHit {
  timestamp: string;
  action: string;
  staff_id: string;
  metadata?: { ip_address?: string };
}

export async function POST(req: NextRequest) {
  const { errorResponse } = await requireApiPrivileged(["DPO", "Admin"]);
  if (errorResponse) return errorResponse;

  const { client: esClient, error: esConfigError } = getElasticsearchClient();
  if (!esClient) {
    logger.error("Elasticsearch forensic backend unavailable.", {
      error: esConfigError,
    });
    return NextResponse.json(
      { error: "Forensic audit backend is not configured." },
      { status: 503 }
    );
  }

  try {
    const { staffId, patientId, actionType } = await req.json();

    const mustQueries: Record<string, unknown>[] = [];
    if (staffId) mustQueries.push({ term: { staff_id: staffId } });
    if (patientId) mustQueries.push({ term: { "metadata.patient_id_hash": patientId } });
    if (actionType) mustQueries.push({ term: { action: actionType } });

    const result = await esClient.search({
      index: "audit_reads",
      size: 500,
      sort: [{ timestamp: { order: "desc" } }],
      query: mustQueries.length > 0 ? { bool: { must: mustQueries } } : { match_all: {} },
    });

    const logs = result.hits.hits.map((hit) => hit._source as AuditHit);

    const pdfDoc = await PDFDocument.create();
    let page = pdfDoc.addPage([600, 800]);

    page.drawText("HIPAA/DPDP FORENSIC AUDIT REPORT", {
      x: 50,
      y: 750,
      size: 18,
      color: rgb(0.1, 0.1, 0.3),
    });
    page.drawText(`Generated on: ${formatAppTimestamp(new Date())} (ap-south-1 Data Residency)`, {
      x: 50,
      y: 730,
      size: 10,
    });

    page.drawText("Query Parameters:", { x: 50, y: 700, size: 12, color: rgb(0, 0, 0) });
    page.drawText(`Staff ID Filter: ${staffId || "ALL"}`, { x: 50, y: 685, size: 10 });
    page.drawText(`Patient ID Hash Filter: ${patientId || "ALL"}`, { x: 50, y: 670, size: 10 });

    page.drawText("TIMESTAMP (IST)", { x: 50, y: 630, size: 9, color: rgb(0.4, 0.4, 0.4) });
    page.drawText("ACTION", { x: 200, y: 630, size: 9, color: rgb(0.4, 0.4, 0.4) });
    page.drawText("STAFF ID", { x: 300, y: 630, size: 9, color: rgb(0.4, 0.4, 0.4) });
    page.drawText("IP ADDRESS", { x: 400, y: 630, size: 9, color: rgb(0.4, 0.4, 0.4) });

    let yPos = 610;

    for (const log of logs) {
      if (yPos < 50) {
        page = pdfDoc.addPage([600, 800]);
        yPos = 750;
      }

      page.drawText(formatAppTimestamp(log.timestamp), {
        x: 50,
        y: yPos,
        size: 8,
      });
      page.drawText(log.action || "UNKNOWN", { x: 200, y: yPos, size: 8 });
      page.drawText(log.staff_id || "UNKNOWN", { x: 300, y: yPos, size: 8 });
      page.drawText(log.metadata?.ip_address || "UNAVAILABLE", { x: 400, y: yPos, size: 8 });

      yPos -= 15;
    }

    const pdfBytes = await pdfDoc.save();

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="hipaa_dpdp_forensic_audit.pdf"',
      },
    });
  } catch (error: unknown) {
    logger.error("Forensic export failed.", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Failed to generate forensic report." }, { status: 500 });
  }
}
