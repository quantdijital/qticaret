import { Link } from "@tanstack/react-router"
import { ArrowLeft } from "lucide-react"
import type { ReactNode } from "react"
import { useDocumentTitle } from "../hooks/use-document-title"

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

/** Every page starts with it (docs/18 §7); its title is the browser tab's too. */
export function PageHeader({ title, description, action, badge, back }: PageHeaderProps) {
  useDocumentTitle(title)
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
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1 sm:flex-[1_1_5.5rem]">
          <div className="flex flex-wrap items-center gap-3">
            {/* A title with no break in it (a customer known by e-mail only) wraps anywhere */}
            <h1 className="min-w-0 text-2xl leading-8 font-semibold tracking-[-0.015em] wrap-anywhere">
              {title}
            </h1>
            {badge}
          </div>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {action ? (
          <div className="flex max-w-full shrink-0 flex-wrap items-center gap-2">{action}</div>
        ) : null}
      </div>
    </header>
  )
}
