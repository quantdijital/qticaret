import type { ReactNode } from "react"

interface PageHeaderProps {
  title: string
  /** One sentence; none when the title says it all. */
  description?: string
  /** The page's one primary action; secondary ones belong in a menu. */
  action?: ReactNode
}

/** Every page starts with it (docs/18 §7). */
export function PageHeader({ title, description, action }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex flex-col gap-1">
        <h1 className="text-[22px] font-semibold leading-7 tracking-[-0.01em]">{title}</h1>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  )
}
