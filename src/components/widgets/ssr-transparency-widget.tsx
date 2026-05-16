import { createAuthenticatedClient } from "@/lib/auth-guard";

interface TransparencyWidgetProps {
  hospitalId: string;
}

export default async function SSRTransparencyWidget({ hospitalId }: TransparencyWidgetProps) {
  const supabase = await createAuthenticatedClient();

  const { data, error } = await supabase
    .from("mv_sla_compliance_percentage")
    .select("compliance_percentage, total")
    .eq("hospital_id", hospitalId)
    .single();

  if (error || !data) {
    return (
      <div className="rounded-lg border bg-muted/30 p-4">
        <span className="text-sm font-medium text-muted-foreground">Compliance data unavailable</span>
      </div>
    );
  }

  const percentage = Number(data.compliance_percentage);

  return (
    <div className="rounded-lg border bg-muted/30 p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h4 className="text-xs font-semibold uppercase text-muted-foreground">SLA Compliance</h4>
          <p className="mt-1 text-xs text-muted-foreground">
            Based on {data.total} recorded interactions
          </p>
        </div>
        <div className="text-right">
          <span className={`text-2xl font-semibold ${percentage >= 95 ? 'text-emerald-600' : percentage >= 80 ? 'text-amber-600' : 'text-destructive'}`}>
            {percentage}%
          </span>
        </div>
      </div>
    </div>
  );
}
