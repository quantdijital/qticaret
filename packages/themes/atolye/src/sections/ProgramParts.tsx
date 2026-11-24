import { BedDouble, Bus, Coffee, Moon, Sun, Utensils } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import type { ProgramTag } from "@qticaret/types"
import type { ImageView, ProgramStepView } from "@qticaret/ui"
import { Prose } from "../content/Prose"

/** The tags' icons, from the trust badges' line set at their stroke. */
const TAG_ICONS: Record<ProgramTag, LucideIcon> = {
  breakfast: Coffee,
  lunch: Utensils,
  dinner: Moon,
  accommodation: BedDouble,
  transport: Bus,
  free_time: Sun,
}

/** A step's picture: a 4:3 frame on the photo well, sized for its column (no shift). */
function StepPicture({ image }: { image: ImageView }) {
  return (
    <picture className="block aspect-4/3 overflow-hidden rounded-media bg-media">
      {image.sources.avif && (
        <source
          type="image/avif"
          srcSet={image.sources.avif}
          sizes="(min-width: 64rem) 20rem, 100vw"
        />
      )}
      {image.sources.webp && (
        <source
          type="image/webp"
          srcSet={image.sources.webp}
          sizes="(min-width: 64rem) 20rem, 100vw"
        />
      )}
      <img
        src={image.src}
        alt={image.alt}
        width={image.width ?? undefined}
        height={image.height ?? undefined}
        loading="lazy"
        decoding="async"
        className="h-full w-full object-cover"
      />
    </picture>
  )
}

/** What a step includes, as small chips with their icon; none: nothing. */
export function StepTags({ tags }: { tags: ProgramStepView["tags"] }) {
  if (tags.length === 0) {
    return null
  }
  return (
    <ul className="flex flex-wrap gap-2">
      {tags.map((tag) => {
        const Icon = TAG_ICONS[tag.key]
        return (
          <li
            key={tag.key}
            className="inline-flex items-center gap-1.5 rounded-full gf-pane px-3 py-1 text-sm text-text-2"
          >
            <Icon className="size-4 shrink-0" aria-hidden="true" strokeWidth={1.75} />
            {tag.label}
          </li>
        )
      })}
    </ul>
  )
}

/** A step's own words and picture: its tags, its text, its photograph beside from 1024 px. */
export function StepBody({ step }: { step: ProgramStepView }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_20rem] lg:gap-6">
      <div className="flex min-w-0 flex-col gap-3">
        <StepTags tags={step.tags} />
        {step.bodyHtml && <Prose html={step.bodyHtml} className="gf-prose--small" />}
      </div>
      {step.image && <StepPicture image={step.image} />}
    </div>
  )
}
