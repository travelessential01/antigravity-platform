import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

type PageShellProps = {
  eyebrow?: string
  title: string
  description?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
  contentClassName?: string
}

export function PageShell({
  eyebrow,
  title,
  description,
  actions,
  children,
  className,
  contentClassName,
}: PageShellProps) {
  return (
    <main className={cn("min-h-screen bg-background text-foreground", className)}>
      <div
        className={cn(
          "mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8",
          contentClassName
        )}
      >
        <header className="flex flex-col gap-4 border-b border-border pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            {eyebrow ? (
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                {eyebrow}
              </p>
            ) : null}
            <div className="space-y-1">
              <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
              {description ? (
                <p className="max-w-3xl text-sm text-muted-foreground">
                  {description}
                </p>
              ) : null}
            </div>
          </div>
          {actions ? <div className="shrink-0">{actions}</div> : null}
        </header>

        {children}
      </div>
    </main>
  )
}
