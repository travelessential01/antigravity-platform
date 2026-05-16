import { NextRequest, NextResponse } from "next/server";
import { requireApiPrivileged } from "@/lib/api-auth";
import { getElasticsearchClient } from "@/lib/elasticsearch";
import { logger } from "@/lib/logger";

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
    const body = await req.json();
    const { staffId, patientId, actionType, fromDate, toDate, page = 1, limit = 50 } = body;

    const mustQueries: Record<string, unknown>[] = [];

    if (staffId) {
      mustQueries.push({ term: { staff_id: staffId } });
    }

    if (patientId) {
      mustQueries.push({ term: { "metadata.patient_id_hash": patientId } });
    }

    if (actionType) {
      mustQueries.push({ term: { action: actionType } });
    }

    if (fromDate || toDate) {
      const range: Record<string, string> = {};
      if (fromDate) range.gte = fromDate;
      if (toDate) range.lte = toDate;
      mustQueries.push({ range: { timestamp: range } });
    }

    const fromOffset = (page - 1) * limit;

    const result = await esClient.search({
      index: "audit_reads",
      from: fromOffset,
      size: limit,
      sort: [{ timestamp: { order: "desc" } }],
      query: mustQueries.length > 0 ? { bool: { must: mustQueries } } : { match_all: {} },
    });

    const hits = result.hits.hits.map((hit) => ({
      id: hit._id,
      ...(hit._source as Record<string, unknown>),
    }));

    return NextResponse.json(
      {
        total: result.hits.total,
        page,
        limit,
        data: hits,
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    logger.error("Elasticsearch DPDP query failed.", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Forensic Audit query failed." }, { status: 500 });
  }
}
