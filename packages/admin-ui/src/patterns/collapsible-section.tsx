import { ChevronDown } from "lucide-react"
import { createContext, useContext, useId } from "react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { ADMIN_UI_NS } from "../i18n"
import { cn } from "../lib/utils"
import { useSectionOpen } from "../hooks/use-section-open"

export interface CollapseOptions {
  /** The section's element id: the advisor's jumps land on it (`revealSection`). */
  id: string
  /** Its name in the person's remembered choices ("content.seo"). */
  name: string
  /** One line said when it is closed: what is in it ("Başlık 58/60 · Açıklama 142/160"). */
  summary: string
  /** Something in it to see to (an urgent finding, an empty required field): it opens. */
  attention?: boolean
  /** Open the first time, before the person chose. */
  defaultOpen?: boolean
}

interface CollapsibleSectionProps extends CollapseOptions {
  title: string
  /** One sentence under the title while it is open. */
  description?: string | undefined
  /** Right of the title while it is open: an action of its own. */
  action?: ReactNode
  /** Unsaved edits inside: said in place of the summary while it is closed. */
  dirty?: boolean
  className?: string | undefined
  children: ReactNode
}

// Whether the section around is open; outside one, always
const OpenContext = createContext(true)

/**
 * Drawn only while the section around it is open: a chart sizes itself
 * to its box, and a closed section's box has no size.
 */
export function WhileOpen({ children }: { children: ReactNode }) {
  return useContext(OpenContext) ? children : null
}

/**
 * A card that folds to its title and a one-line summary (docs/18 §7), so
 * a page's secondary parts (search appearance, summary, cover) do not
 * push its main one out of sight. The whole header opens and closes it;
 * closed, its fields stay where they are (hidden, not unmounted): an
 * unsaved edit survives, and the header says it is there.
 */
export function CollapsibleSection({
  id,
  name,
  summary,
  attention = false,
  defaultOpen = false,
  title,
  description,
  action,
  dirty = false,
  className,
  children,
}: CollapsibleSectionProps) {
  const { t } = useTranslation(ADMIN_UI_NS)
  const { open, toggle } = useSectionOpen({ id, name, attention, defaultOpen })
  const base = useId()
  const body = `${base}-body`
  const note = `${base}-note`
  const unsaved = dirty && !open
  const line = open ? description : unsaved ? t("common.unsaved") : summary
  return (
    <section
      id={id}
      data-open={open ? "" : undefined}
      className={cn(
        "flex min-w-0 scroll-mt-20 flex-col rounded-lg border bg-card text-card-foreground shadow-card",
        className
      )}
    >
      {/* The title's button covers the whole header, so a click anywhere on it opens or closes;
          an action that does not fit beside the title goes under it (a phone) */}
      <header className="group relative flex min-h-14 flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
        <div className="flex min-w-0 flex-[1_1_12rem] flex-col gap-0.5">
          <h2 className="text-[15px] leading-6 font-semibold">
            <button
              type="button"
              aria-expanded={open}
              aria-controls={body}
              aria-describedby={line ? note : undefined}
              onClick={toggle}
              className="text-left outline-none after:absolute after:inset-0 after:rounded-lg focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-ring focus-visible:after:outline-solid [html[data-input=pointer]_&]:after:outline-none"
            >
              {title}
            </button>
          </h2>
          {line ? (
            <p
              id={note}
              className={cn(
                "text-[13px] leading-5",
                // Closed, one line (two on a phone, where the line is short)
                open ? "text-muted-foreground" : "line-clamp-2 break-words sm:line-clamp-1",
                !open && (unsaved || attention) ? "text-warning-text" : "",
                !open && !unsaved && !attention ? "text-muted-foreground" : ""
              )}
            >
              {line}
            </p>
          ) : null}
        </div>
        {open && action ? (
          <div className="relative order-last flex shrink-0 basis-full flex-wrap items-center gap-2 sm:order-none sm:basis-auto">
            {action}
          </div>
        ) : null}
        <ChevronDown
          aria-hidden="true"
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform duration-[var(--duration-fast)] group-hover:text-foreground",
            open && "rotate-180"
          )}
        />
      </header>
      <div id={body} hidden={!open} className="flex min-w-0 flex-1 flex-col px-5 pb-5">
        <OpenContext value={open}>{children}</OpenContext>
      </div>
    </section>
  )
}
