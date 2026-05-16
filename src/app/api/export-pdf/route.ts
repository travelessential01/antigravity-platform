import { NextRequest, NextResponse } from "next/server";
import { generateQualityCoordinatorReport } from "@/lib/pdfGenerator";
import { requireApiPrivileged } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase-admin";
import { formatAppReportDate } from "@/lib/app-time";

export async function GET(req: NextRequest) {
  const { user, errorResponse } = await requireApiPrivileged([
    "Admin",
    "Quality Coordinator",
    "DPO",
    "Medical Superintendent",
  ]);
  if (errorResponse || !user) return errorResponse!;

  const hospitalId = req.nextUrl.searchParams.get("hospitalId");
  if (!hospitalId) {
    return NextResponse.json({ error: "Missing hospitalId" }, { status: 400 });
  }

  const requiresHospitalScope =
    user.role === "quality_coordinator" || user.role === "medical_superintendent";

  if (requiresHospitalScope && (!user.hospitalId || user.hospitalId !== hospitalId)) {
    return NextResponse.json({ error: "Forbidden: hospital out of scope." }, { status: 403 });
  }

  const reportSupabase = createAdminClient();

  const { data: hospital } = await reportSupabase
    .from("hospitals")
    .select("name")
    .eq("id", hospitalId)
    .single();

  const [complianceResult, heatmapResult, resolutionResult] = await Promise.all([
    reportSupabase
      .from("mv_sla_compliance_percentage")
      .select("*")
      .eq("hospital_id", hospitalId)
      .single(),
    reportSupabase.from("mv_department_heatmap").select("*").eq("hospital_id", hospitalId),
    reportSupabase
      .from("mv_avg_resolution_time")
      .select("*")
      .eq("hospital_id", hospitalId)
      .single(),
  ]);

  if (!complianceResult.data) {
    return NextResponse.json({ error: "No compliance data found for hospital" }, { status: 404 });
  }

  const pdfBytes = await generateQualityCoordinatorReport({
    hospitalName: hospital?.name || "Unknown Facility",
    reportDate: formatAppReportDate(),
    totalComplaints: complianceResult.data.total || 0,
    compliancePercentage: complianceResult.data.compliance_percentage || 0,
    avgResolutionTime: resolutionResult.data?.avg_resolution_hours
      ? Number(resolutionResult.data.avg_resolution_hours).toFixed(2)
      : "N/A",
    departmentHeatmap: heatmapResult.data || [],
  });

  return new NextResponse(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Quality_Report_${hospitalId}_${Date.now()}.pdf"`,
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    },
  });
}
