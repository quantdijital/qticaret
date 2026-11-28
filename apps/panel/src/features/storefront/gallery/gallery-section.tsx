import { useId } from "react"
import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
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
