import { ChevronDown } from "lucide-react"
import { useId, useState } from "react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import { cn } from "@qticaret/admin-ui/lib/utils"
import { TitleTip } from "@qticaret/admin-ui/patterns/info-tip"
import { Skeleton } from "@qticaret/admin-ui/ui/skeleton"

// Phone one, tablet two, wide three (docs/18 §3: looks are told apart by sight, PLAN §4.2)
export const GRID = "grid grid-cols-1 items-stretch gap-3 sm:grid-cols-2 xl:grid-cols-3"

/**
 * A titled run of looks on the page itself: the cards are the surfaces,
 * never cards inside a card (docs/18 §3); what the run is for behind an (i).
 */
export function GallerySection({
  title,
  hint,
  children,
}: {
  title: string
  hint: string
  children: ReactNode
}) {
  const id = useId()
  return (
    <section aria-labelledby={id} className="flex min-w-0 flex-col gap-2.5">
      <div className="flex items-start gap-1.5">
        <h2 id={id} className="text-[15px] leading-6 font-semibold">
          {title}
        </h2>
        <TitleTip title={title} hint={hint} />
      </div>
      {children}
    </section>
  )
}

/**
 * A run of looks folded to its title (the other sectors' looks, owner
 * 2026-11-28): the title is the button, a line under it says what is in
 * it while closed; open, the cards stand on the page as the run above
 * (never cards inside a card, docs/18 §3).
 */
export function FoldedSection({
  title,
  summary,
  defaultOpen = false,
  children,
}: {
  title: string
  summary: string
  /** Open at first: one of its looks is in the draft or live. */
  defaultOpen?: boolean
  children: ReactNode
}) {
  const id = useId()
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section aria-labelledby={`${id}-title`} className="flex min-w-0 flex-col gap-2.5">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-[15px] leading-6 font-semibold">
          <button
            id={`${id}-title`}
            type="button"
            aria-expanded={open}
            aria-controls={`${id}-body`}
            onClick={() => {
              setOpen((was) => !was)
            }}
            className="flex items-center gap-1.5 rounded-md text-left transition-colors hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <ChevronDown
              aria-hidden
              className={cn("size-4 shrink-0 transition-transform", open ? "" : "-rotate-90")}
            />
            {title}
          </button>
        </h2>
        {open ? null : <p className="pl-5.5 text-xs text-muted-foreground">{summary}</p>}
      </div>
      <div id={`${id}-body`} hidden={!open} className="flex flex-col gap-4">
        {children}
      </div>
    </section>
  )
}

/** One sector's looks under its name, inside the folded run. */
export function SectorRun({ name, children }: { name: string; children: ReactNode }) {
  const id = useId()
  return (
    <section aria-labelledby={id} className="flex min-w-0 flex-col gap-2">
      <h3 id={id} className="text-[13px] leading-5 font-medium text-muted-foreground">
        {name}
      </h3>
      {children}
    </section>
  )
}

export function CardsLoading({ count }: { count: number }) {
  const { t } = useTranslation()
  return (
    <div aria-busy="true" className={GRID}>
      <span className="sr-only">{t("common.loading")}</span>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="flex flex-col gap-2.5 rounded-lg border p-2.5">
          <Skeleton className="aspect-[16/10] w-full rounded-md" />
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-8 w-28" />
        </div>
      ))}
    </div>
  )
}
