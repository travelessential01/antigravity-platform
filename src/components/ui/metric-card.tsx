import type { ReactNode } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type MetricCardProps = {
  label: string
  value: ReactNode
  icon?: ReactNode
  detail?: ReactNode
  tone?: "default" | "success" | "warning" | "danger" | "info"
}

const toneClasses = {
  default: "bg-muted text-muted-foreground",
  success: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-50 text-amber-700",
  danger: "bg-destructive/10 text-destructive",
  info: "bg-sky-50 text-sky-700",
}

export function MetricCard({
  label,
  value,
  icon,
  detail,
  tone = "default",
}: MetricCardProps) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3">
        {icon ? (
          <div className={cn("flex size-10 items-center justify-center rounded-lg", toneClasses[tone])}>
            {icon}
          </div>
        ) : null}
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
          {detail ? <p className="mt-1 text-xs text-muted-foreground">{detail}</p> : null}
        </div>
      </CardContent>
    </Card>
  )
}
