import { fieldMark } from "@qticaret/ui"
import type { LinkView } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"

/**
 * A section's head: its h2 on the left, the link to the whole list on
 * the right on the h2's baseline (Tezgâh audit Y-07; a destination, never
 * a label above the head). `children` sits under the head (a tab row). In a section the shop
 * centred (its look, `Look.tsx`) the link stands under the centred head.
 */
export function SectionHead({
  id,
  title,
  more,
  className,
  marks,
  ownMore = false,
}: {
  id: string
  title: string
  more?: LinkView | null
  className?: string
  /** The editor's live preview (adr/0065 Faz 2b): the title carries its field mark. */
  marks?: boolean | undefined
  /** The link is the shop's own (`more`, a field of its form): in the preview it is marked too. */
  ownMore?: boolean
}) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-4 group-data-[align=center]/look:flex-col group-data-[align=center]/look:items-center group-data-[align=center]/look:gap-1 group-data-[align=center]/look:text-center",
        className
      )}
    >
      <h2 id={id} {...fieldMark(marks, "title")}>
        {title}
      </h2>
      {more && (
        <a
          href={more.path}
          className="gf-link shrink-0 text-sm lg:text-md"
          {...fieldMark(marks && ownMore, "more")}
        >
          {more.label}
        </a>
      )}
    </div>
  )
}
