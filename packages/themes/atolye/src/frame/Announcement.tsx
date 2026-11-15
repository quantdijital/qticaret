import { Phone } from "lucide-react"
import type { AnnouncementSettings } from "@qticaret/types"
import { sectionMark } from "@qticaret/ui"
import type { ContactView, LinkView } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"
import { Container } from "../parts/Container"
import { AnnouncementTurns } from "./AnnouncementTurns"
import { announcementStepsOf } from "./announcement-steps"

/** The bar's lines as the shop wants several shown (docs/tema/bilesen-denetimi (b) 6). */
function Lines({
  lines,
  keys,
  settings,
  words,
}: {
  lines: readonly string[]
  /** Each line's field key in the editor's live preview; none elsewhere. */
  keys: readonly string[] | undefined
  settings: AnnouncementSettings | undefined
  words: { announcements: string; pause: string; play: string }
}) {
  const mode = lines.length > 1 ? (settings?.mode ?? "first") : "first"
  // A line's field mark (adr/0065 Faz 2b): its place among the bar's lines in the design
  const qf = (index: number) => (keys?.[index] ? { "data-qf": keys[index] } : {})
  const { align, size } = announcementStepsOf(settings)
  if (mode === "rotate" && settings) {
    return <AnnouncementTurns lines={lines} keys={keys} settings={settings} words={words} />
  }
  if (mode === "inline") {
    // Side by side on a wide screen; a phone has room for the first only
    return (
      <ul
        aria-label={words.announcements}
        className={cn(
          "flex min-w-0 flex-wrap items-center",
          align.justify,
          "gap-x-3",
          size.pad,
          "font-semibold",
          align.listWide
        )}
      >
        {lines.map((line, index) => (
          <li
            key={index}
            {...qf(index)}
            className={cn("flex items-center gap-x-3", index > 0 && "max-lg:hidden")}
          >
            {index > 0 && (
              <span aria-hidden="true" className="text-stage-text-2">
                ·
              </span>
            )}
            {line}
          </li>
        ))}
      </ul>
    )
  }
  return (
    <p
      aria-label={words.announcements}
      className={cn(size.pad, align.text, "font-semibold", align.textWide)}
      {...qf(0)}
    >
      {lines[0]}
    </p>
  )
}

/**
 * The bar above the header, graphite: the shop's message (its
 * free-shipping threshold or campaign), centred on a phone and at the start
 * from 1024 px unless the shop sets it at the start, the middle or the end
 * (`align`; `announcement-steps.ts` has the rule beside the links), in one
 * of three sizes; from 1024 px the shop's small links and phone sit at its
 * end. Several lines show as the shop chose: the first alone (as before),
 * taking turns in one place (`AnnouncementTurns`: stops on hover, focus
 * and its pause button, still under reduced motion) or side by side on a
 * wide screen. Without a line a phone draws nothing; without lines, links
 * or phone nothing is drawn.
 */
export function Announcement({
  lines,
  settings,
  links,
  contact,
  words,
  mark,
}: {
  lines: readonly string[]
  /** How several lines show; absent (an older storefront): the first alone. */
  settings?: AnnouncementSettings | undefined
  links: readonly LinkView[]
  contact: ContactView
  words: { announcements: string; links: string; pause: string; play: string }
  /**
   * The bar's section id in the theme editor's live preview (adr/0065 Faz
   * 2b): the bar carries its section mark and each line its field mark
   * (`lines.<n>`, its place in the design). Absent on a live page.
   */
  mark?: string | undefined
}) {
  const kept = lines.flatMap((line, at) => (line.length > 0 ? [{ line, at }] : []))
  const shown = kept.map(({ line }) => line)
  const keys = mark ? kept.map(({ at }) => `lines.${String(at)}`) : undefined
  const phone = contact.phone && contact.phoneHref ? contact : null
  const wide = links.length > 0 || phone !== null
  if (shown.length === 0 && !wide) {
    return null
  }
  const { align, size } = announcementStepsOf(settings)
  const tappable = cn("inline-flex", size.height, "items-center")
  return (
    <div
      {...sectionMark(mark)}
      className={cn("gf-stage", size.text, shown.length === 0 && "max-lg:hidden")}
    >
      <Container
        className={cn(
          "flex",
          size.height,
          "items-center",
          align.justify,
          "gap-6",
          align.barWide,
          wide && align.spacer
        )}
      >
        {shown.length > 0 && <Lines lines={shown} keys={keys} settings={settings} words={words} />}
        {wide && (
          <nav
            aria-label={words.links}
            className={cn(align.nav, "hidden items-center gap-1 lg:flex", align.navWide)}
          >
            {links.map((link) => (
              <a
                key={link.path}
                href={link.path}
                className={cn(
                  tappable,
                  "rounded-button px-3 text-stage-text-2 pointer-coarse:min-h-11 no-underline hover:text-stage-text"
                )}
              >
                {link.label}
              </a>
            ))}
            {phone && (
              <a
                href={phone.phoneHref ?? undefined}
                className={cn(
                  "tabular",
                  tappable,
                  "gap-2 rounded-button px-3 font-semibold pointer-coarse:min-h-11 no-underline"
                )}
              >
                <Phone className="size-4" aria-hidden="true" strokeWidth={2} />
                {phone.phone}
              </a>
            )}
          </nav>
        )}
      </Container>
    </div>
  )
}
