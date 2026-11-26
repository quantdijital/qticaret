import { Link } from "@tanstack/react-router"
import { ArrowLeft } from "lucide-react"
import { useLayoutEffect, useRef } from "react"
import type { ReactNode } from "react"
import { useDocumentTitle } from "../hooks/use-document-title"
import { cn } from "../lib/utils"

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
  /**
   * Held under the top bar while the page scrolls (a long editor whose
   * save sits in the header, WordPress's): the title keeps one line, the
   * back link scrolls away. Its height is the page's `--page-header-height`,
   * so what sticks under it (a section bar, a side column) stands below.
   * The header must sit straight in the page's column (`flex-col` with
   * `--grid-gap`): it sticks within that.
   */
  sticky?: boolean
}

/** A sticky header's height, kept on the page while it is drawn. */
function useHeaderHeight(sticky: boolean) {
  const ref = useRef<HTMLElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!sticky || !el) {
      return
    }
    const root = document.documentElement
    const measure = () => {
      root.style.setProperty("--page-header-height", `${String(el.offsetHeight)}px`)
    }
    measure()
    const watcher = typeof ResizeObserver === "function" ? new ResizeObserver(measure) : null
    watcher?.observe(el)
    return () => {
      watcher?.disconnect()
      root.style.removeProperty("--page-header-height")
    }
  }, [sticky])
  return ref
}

/** Every page starts with it (docs/18 §7); its title is the browser tab's too. */
export function PageHeader({
  title,
  description,
  action,
  badge,
  back,
  sticky = false,
}: PageHeaderProps) {
  useDocumentTitle(title)
  const ref = useHeaderHeight(sticky)
  const backLink = back ? (
    <Link
      to={back.to}
      search={back.search ?? {}}
      // Sticky, the link stands in the page's column: its gap less, as inside the header
      className={cn(
        "inline-flex w-fit items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground",
        sticky && "-mb-1"
      )}
    >
      <ArrowLeft className="size-3.5" aria-hidden="true" />
      {back.label}
    </Link>
  ) : null
  const row = (
    <div
      className={cn(
        "flex flex-col",
        // Held (the owner 2026-11-26: a cramped row): below `lg` the actions always take
        // their own line under the title, from `lg` one row whose title gives way; so the
        // header never changes height when "Vazgeç" comes and goes
        sticky
          ? "gap-2 lg:flex-row lg:items-center lg:justify-between lg:gap-4"
          : "gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between"
      )}
    >
      {/* The title keeps room enough to be read: the actions wrap under it sooner */}
      <div
        className={cn("flex min-w-0 flex-col gap-1", sticky ? "lg:flex-1" : "sm:flex-[1_1_5.5rem]")}
      >
        <div className={cn("flex items-center gap-3", sticky ? "min-w-0" : "flex-wrap")}>
          {/* A title with no break in it (a customer known by e-mail only) wraps anywhere; held, it keeps one line */}
          <h1
            title={sticky ? title : undefined}
            className={cn(
              "min-w-0 text-2xl leading-8 font-semibold tracking-[-0.015em]",
              sticky ? "truncate" : "wrap-anywhere"
            )}
          >
            {title}
          </h1>
          {sticky && badge ? <span className="flex shrink-0">{badge}</span> : badge}
        </div>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {action ? (
        <div className="flex max-w-full shrink-0 flex-wrap items-center gap-2">{action}</div>
      ) : null}
    </div>
  )
  if (!sticky) {
    return (
      <header className="flex flex-col gap-3">
        {backLink}
        {row}
      </header>
    )
  }
  return (
    <>
      {backLink}
      <header
        ref={ref}
        data-page-header-sticky=""
        className="sticky top-[var(--layout-topbar-height)] z-10 -my-2 bg-background py-2"
      >
        {row}
      </header>
    </>
  )
}
