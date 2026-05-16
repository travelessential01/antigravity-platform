import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Building2,
  Clock,
  Download,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { PageShell } from "@/components/layout/page-shell";
import SSRTransparencyWidget from "@/components/widgets/ssr-transparency-widget";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MetricCard } from "@/components/ui/metric-card";
import { createAuthenticatedClient } from "@/lib/auth-guard";

// Auth enforced by (admin)/layout.tsx -> requirePrivileged(['Admin', 'Medical Superintendent'])
// User-scoped Supabase client queries respect RLS.
export default async function AdminDashboardPage() {
  const supabase = await createAuthenticatedClient();

  // Org ID is read from environment variable until org scope is derived from session.
  const orgId = process.env.NEXT_PUBLIC_ORG_ID ?? "d2f46abc-f4e1-4294-9ab8-f03799cccac9";

  const [
    { data: orgCompliance },
    { data: orgTrends },
    { data: orgBenchmarks },
    { data: hospitals },
    { data: capaEffectiveness },
  ] = await Promise.all([
    supabase.from("mv_org_sla_compliance").select("*").eq("organization_id", orgId).single(),
    supabase.from("mv_org_complaint_trends").select("*").eq("organization_id", orgId).limit(5),
    supabase.from("mv_org_resolution_benchmarks").select("*").eq("organization_id", orgId),
    supabase
      .from("hospitals")
      .select("id, name, nabh_accredited, jci_accredited")
      .eq("organization_id", orgId),
    supabase.from("mv_capa_effectiveness").select("*").limit(1).single(),
  ]);

  const compliancePercentage = Number(orgCompliance?.compliance_percentage ?? 100);
  const totalComplaints = Number(orgCompliance?.total ?? 0);
  const breachedComplaints = Number(orgCompliance?.breached ?? 0);
  const intakeVolume =
    orgTrends?.reduce((sum, row) => sum + Number(row.total_complaints ?? 0), 0) ?? 0;
  const averageResolutionHours =
    orgBenchmarks && orgBenchmarks.length > 0
      ? orgBenchmarks.reduce(
          (sum, row) => sum + Number(row.avg_resolution_hours ?? 0),
          0
        ) / orgBenchmarks.length
      : 0;
  const capaBefore = Number(capaEffectiveness?.vol_before_30d ?? 0);
  const capaAfter = Number(capaEffectiveness?.vol_after_30d ?? 0);
  const capaMax = Math.max(capaBefore, capaAfter, 1);
  const capaBeforeHeight = Math.max(12, (capaBefore / capaMax) * 100);
  const capaAfterHeight = Math.max(12, (capaAfter / capaMax) * 100);

  return (
    <PageShell
      eyebrow="Organization Intelligence"
      title="Network compliance overview"
      description="PHI-stripped executive dashboard across facilities, SLA performance, and corrective-action signals."
      actions={
        <Badge variant="outline" className="gap-2">
          <ShieldCheck className="size-3.5 text-emerald-600" />
          Zero PHI audit view
        </Badge>
      }
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Global SLA compliance"
          value={`${compliancePercentage.toFixed(1)}%`}
          detail={`${totalComplaints} total grievances`}
          icon={<Activity className="size-5" />}
          tone="success"
        />
        <MetricCard
          label="Cross-org SLA breaches"
          value={breachedComplaints}
          icon={<AlertTriangle className="size-5" />}
          tone="danger"
        />
        <MetricCard
          label="Gross intake volume"
          value={intakeVolume}
          detail="Current trend window"
          icon={<TrendingUp className="size-5" />}
          tone="info"
        />
        <MetricCard
          label="Avg resolution timeline"
          value={`${averageResolutionHours.toFixed(1)}h`}
          icon={<Clock className="size-5" />}
          tone="warning"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>CAPA impact sample</CardTitle>
          <CardDescription>
            Before/after complaint volume for the latest corrective-action sample.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-8">
            <div className="grid h-36 w-40 grid-cols-2 items-end gap-4 border-b border-border px-2">
              <div className="flex h-full flex-col justify-end gap-2">
                <div
                  className="rounded-t-md bg-destructive/20"
                  style={{ height: `${capaBeforeHeight}%` }}
                />
                <p className="text-center text-xs text-muted-foreground">Before</p>
              </div>
              <div className="flex h-full flex-col justify-end gap-2">
                <div
                  className="rounded-t-md bg-emerald-200"
                  style={{ height: `${capaAfterHeight}%` }}
                />
                <p className="text-center text-xs text-muted-foreground">After</p>
              </div>
            </div>
            <div className="space-y-2 text-sm">
              <p>
                <span className="font-medium">{capaBefore}</span>{" "}
                complaints before intervention
              </p>
              <p>
                <span className="font-medium">{capaAfter}</span>{" "}
                complaints after intervention
              </p>
              <p className="text-muted-foreground">
                Values are PHI-stripped and suitable for executive review.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Hospital facilities</CardTitle>
          <CardDescription>
            Facility-level compliance status, transparency widgets, and report exports.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {hospitals && hospitals.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {hospitals.map((hospital) => (
                <section
                  key={hospital.id}
                  className="flex min-h-64 flex-col rounded-lg border bg-background p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-semibold">{hospital.name}</h3>
                      <p className="mt-1 font-mono text-xs text-muted-foreground">
                        {hospital.id.slice(0, 8).toUpperCase()}
                      </p>
                    </div>
                    <Building2 className="size-5 shrink-0 text-muted-foreground" />
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {hospital.nabh_accredited ? (
                      <Badge variant="outline">NABH PRE.7</Badge>
                    ) : null}
                    {hospital.jci_accredited ? (
                      <Badge variant="outline">JCI Ready</Badge>
                    ) : null}
                    {!hospital.nabh_accredited && !hospital.jci_accredited ? (
                      <Badge variant="secondary">Accreditation pending</Badge>
                    ) : null}
                  </div>

                  <div className="mt-4">
                    <SSRTransparencyWidget hospitalId={hospital.id} />
                  </div>

                  <div className="mt-auto flex flex-col gap-2 border-t pt-4 sm:flex-row">
                    <Button asChild variant="outline" size="sm" className="flex-1">
                      <a
                        href={`/api/export-pdf?hospitalId=${hospital.id}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Download className="size-4" />
                        QC report
                      </a>
                    </Button>
                    <Button asChild size="sm" className="flex-1">
                      <Link href={`/dashboard/organization/${hospital.id}`}>
                        Drill down
                        <BarChart3 className="size-4" />
                      </Link>
                    </Button>
                  </div>
                </section>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed bg-muted/30 px-4 py-10 text-center text-sm text-muted-foreground">
              No facilities are registered to this organization.
            </div>
          )}
        </CardContent>
      </Card>
    </PageShell>
  );
}
