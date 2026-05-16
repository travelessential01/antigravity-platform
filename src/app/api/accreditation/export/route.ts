import { NextRequest, NextResponse } from "next/server";
import { parse } from "json2csv";
import { generateNabhPre7Report } from "@/lib/pdfGenerator";
import { requireApiPrivileged } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase-admin";
import { logger } from "@/lib/logger";
import { formatAppReportDate } from "@/lib/app-time";

export async function GET(req: NextRequest) {
  const { user, errorResponse } = await requireApiPrivileged([
    "Admin",
    "Quality Coordinator",
    "Medical Superintendent",
  ]);
  if (errorResponse || !user) return errorResponse!;

  try {
    const searchParams = req.nextUrl.searchParams;
    const hospitalId = searchParams.get("hospitalId");
    const reportType = searchParams.get("type");
    const format = searchParams.get("format") || "pdf";

    if (!hospitalId || !reportType) {
      return NextResponse.json(
        { error: "Missing required parameters: hospitalId or type." },
        { status: 400 }
      );
    }

    const requiresHospitalScope =
      user.role === "quality_coordinator" || user.role === "medical_superintendent";

    if (requiresHospitalScope && (!user.hospitalId || user.hospitalId !== hospitalId)) {
      return NextResponse.json({ error: "Forbidden: hospital out of scope." }, { status: 403 });
    }

    const supabase = createAdminClient();

    if (reportType === "nabh_pre7") {
      const [{ data: hospital }, { data: compliance }] = await Promise.all([
        supabase.from("hospitals").select("name").eq("id", hospitalId).single(),
        supabase
          .from("mv_sla_compliance_percentage")
          .select("*")
          .eq("hospital_id", hospitalId)
          .single(),
      ]);

      const pdfBytes = await generateNabhPre7Report({
        hospitalName: hospital?.name || "Unknown Facility",
        reportDate: formatAppReportDate(),
        totalGrievances: compliance?.total || 0,
        patientRightsViolations: 0,
        clinicalSafetyIncidents: 0,
        slaCompliance: compliance?.compliance_percentage || 0,
        capaValidations: 0,
      });

      return new NextResponse(Buffer.from(pdfBytes), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="nabh_pre7_${hospitalId}.pdf"`,
        },
      });
    }

    if (reportType === "annual_export" && format === "csv") {
      const { data: rawComplaints, error } = await supabase
        .from("complaints")
        .select("id, created_at, status, severity_level, department_id, sla_deadline")
        .eq("hospital_id", hospitalId)
        .gte(
          "created_at",
          new Date(new Date().setFullYear(new Date().getFullYear() - 1)).toISOString()
        )
        .order("created_at", { ascending: false })
        .limit(5000);

      if (error) throw error;

      const csv = parse(rawComplaints || []);

      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="annual_grievances_${hospitalId}.csv"`,
        },
      });
    }

    return NextResponse.json(
      { error: "Unsupported report type or format combination." },
      { status: 400 }
    );
  } catch (error: unknown) {
    logger.error("Accreditation export failed.", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "Failed to generate statutory report." }, { status: 500 });
  }
}
