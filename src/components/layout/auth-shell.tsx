import type { ReactNode } from "react"
import { Card, CardContent } from "@/components/ui/card"

type AuthShellProps = {
  icon: ReactNode
  title: string
  description: ReactNode
  children: ReactNode
  footer?: ReactNode
}

export function AuthShell({
  icon,
  title,
  description,
  children,
  footer,
}: AuthShellProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10 text-foreground">
      <div className="w-full max-w-sm space-y-5">
        <div className="space-y-3 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-lg border border-border bg-card text-primary shadow-sm">
            {icon}
          </div>
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </div>

        <Card>
          <CardContent className="space-y-5">{children}</CardContent>
        </Card>

        {footer ? (
          <div className="text-center text-xs text-muted-foreground">{footer}</div>
        ) : null}
      </div>
    </main>
  )
}
