import type { ReactNode } from "react"
import { AlertTriangle, CheckCircle2, Info, ShieldCheck } from "lucide-react"
import { cn } from "@/lib/utils"

type StatusBannerProps = {
  variant?: "info" | "success" | "warning" | "error"
  title?: ReactNode
  children: ReactNode
  className?: string
}

const variants = {
  info: {
    className: "border-sky-200 bg-sky-50 text-sky-900",
    icon: Info,
  },
  success: {
    className: "border-emerald-200 bg-emerald-50 text-emerald-900",
    icon: CheckCircle2,
  },
  warning: {
    className: "border-amber-200 bg-amber-50 text-amber-900",
    icon: AlertTriangle,
  },
  error: {
    className: "border-destructive/30 bg-destructive/10 text-destructive",
    icon: AlertTriangle,
  },
}

export function StatusBanner({
  variant = "info",
  title,
  children,
  className,
}: StatusBannerProps) {
  const config = variants[variant]
  const Icon = variant === "success" ? ShieldCheck : config.icon

  return (
    <div className={cn("rounded-lg border px-4 py-3 text-sm", config.className, className)}>
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 size-4 shrink-0" />
        <div className="min-w-0">
          {title ? <p className="font-medium">{title}</p> : null}
          <div className={cn(title && "mt-1", "text-sm opacity-90")}>{children}</div>
        </div>
      </div>
    </div>
  )
}
