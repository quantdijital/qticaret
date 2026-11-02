import { ArrowRight } from "lucide-react"
import type { LinkView } from "@qticaret/ui"

/** A section's heading row: its name, and a link to see more when there is one. */
export function SectionHead({
  id,
  title,
  more,
}: {
  id: string
  title: string
  more?: LinkView | null
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <h2 id={id} className="text-3xl leading-tight lg:text-4xl">
        {title}
      </h2>
      {more && (
        <a
          href={more.path}
          className="group flex shrink-0 items-center gap-1.5 text-sm font-medium underline-offset-4 hover:underline"
        >
          {more.label}
          <ArrowRight
            className="size-4 transition-transform group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </a>
      )}
    </div>
  )
}

/** A heading's id from the section's own: unique on the page, stable across requests. */
export const headingId = (sectionId: string) => `bolum-${sectionId}`
