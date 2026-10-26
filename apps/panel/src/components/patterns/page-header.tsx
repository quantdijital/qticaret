import { Link } from "@tanstack/react-router"
import { ArrowLeft } from "lucide-react"
import type { ReactNode } from "react"

interface PageHeaderProps {
  title: string
  /** One sentence; none when the title says it all. */
  description?: string | undefined
  /** The page's one primary action; secondary ones belong in a menu. */
  action?: ReactNode
  /** Next to the title: a status badge. */
  badge?: ReactNode
  /** The list this page belongs to, in the view it came from (`search`). */
  back?: { to: string; search?: Record<string, string>; label: string } | undefined
}

/** Every page starts with it (docs/18 §7). */
export function PageHeader({ title, description, action, badge, back }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-3">
      {back ? (
        <Link
          to={back.to}
          search={back.search ?? {}}
          className="inline-flex w-fit items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          {back.label}
        </Link>
      ) : null}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl leading-8 font-semibold tracking-[-0.015em]">{title}</h1>
            {badge}
          </div>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {action ? <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div> : null}
      </div>
    </header>
  )
}
