import { Phone } from "lucide-react"
import type { AnnouncementSettings } from "@qticaret/types"
import type { ContactView, LinkView } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"
import { Container } from "../parts/Container"
import { AnnouncementTurns } from "./AnnouncementTurns"

/** The bar's lines as the shop wants several shown (docs/tema/bilesen-denetimi (b) 6). */
function Lines({
  lines,
  settings,
  words,
}: {
  lines: readonly string[]
  settings: AnnouncementSettings | undefined
  words: { announcements: string; pause: string; play: string }
}) {
  const mode = lines.length > 1 ? (settings?.mode ?? "first") : "first"
  if (mode === "rotate" && settings) {
    return <AnnouncementTurns lines={lines} settings={settings} words={words} />
  }
  if (mode === "inline") {
    // Side by side on a wide screen; a phone has room for the first only
    return (
      <ul
        aria-label={words.announcements}
        className="flex min-w-0 flex-wrap items-center justify-center gap-x-3 py-2 font-semibold lg:justify-start"
      >
        {lines.map((line, index) => (
          <li key={index} className={cn("flex items-center gap-x-3", index > 0 && "max-lg:hidden")}>
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
    <p aria-label={words.announcements} className="py-2 text-center font-semibold lg:text-left">
      {lines[0]}
    </p>
  )
}

/**
 * The bar above the header, graphite: the shop's message (its
 * free-shipping threshold or campaign), centred on a phone; from 1024 px
 * the shop's small links and phone sit at its end. Several lines show as
 * the shop chose: the first alone (as before), taking turns in one place
 * (`AnnouncementTurns`: stops on hover, focus and its pause button, still
 * under reduced motion) or side by side on a wide screen. Without a line a
 * phone draws nothing; without lines, links or phone nothing is drawn.
 */
export function Announcement({
  lines,
  settings,
  links,
  contact,
  words,
}: {
  lines: readonly string[]
  /** How several lines show; absent (an older storefront): the first alone. */
  settings?: AnnouncementSettings | undefined
  links: readonly LinkView[]
  contact: ContactView
  words: { announcements: string; links: string; pause: string; play: string }
}) {
  const shown = lines.filter((line) => line.length > 0)
  const phone = contact.phone && contact.phoneHref ? contact : null
  const wide = links.length > 0 || phone !== null
  if (shown.length === 0 && !wide) {
    return null
  }
  return (
    <div className={cn("gf-stage text-sm", shown.length === 0 && "max-lg:hidden")}>
      <Container className="flex min-h-9 items-center justify-center gap-6 lg:justify-between">
        {shown.length > 0 && <Lines lines={shown} settings={settings} words={words} />}
        {wide && (
          <nav aria-label={words.links} className="ml-auto hidden items-center gap-1 lg:flex">
            {links.map((link) => (
              <a
                key={link.path}
                href={link.path}
                className="inline-flex min-h-9 items-center rounded-button px-3 text-stage-text-2 pointer-coarse:min-h-11 no-underline hover:text-stage-text"
              >
                {link.label}
              </a>
            ))}
            {phone && (
              <a
                href={phone.phoneHref ?? undefined}
                className="tabular inline-flex min-h-9 items-center gap-2 rounded-button px-3 font-semibold pointer-coarse:min-h-11 no-underline"
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
