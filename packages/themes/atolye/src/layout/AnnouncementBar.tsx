import { Phone } from "lucide-react"
import type { ContactView, LinkView } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"
import { Container } from "../components/Container"

/**
 * The band above the header, in the shop's colour (design.md § Components):
 * its lines on the left, its small links and phone on the right from
 * 1024 px. A phone shows the first line only; without a line the band is
 * not drawn there at all (the links and the phone live in the menu
 * drawer), and without lines, links or phone it is not drawn anywhere.
 * Nothing moves on its own (WCAG 2.2.2); the lines are separate items.
 */
export function AnnouncementBar({
  lines,
  links,
  contact,
  words,
}: {
  lines: readonly string[]
  links: readonly LinkView[]
  contact: ContactView
  words: { announcements: string; links: string }
}) {
  const phone = contact.phone && contact.phoneHref ? contact : null
  const wide = links.length > 0 || phone !== null
  if (lines.length === 0 && !wide) {
    return null
  }
  return (
    <div
      className={cn(
        "at-signal-band bg-signal text-sm text-signal-ink",
        lines.length === 0 && "max-lg:hidden"
      )}
    >
      <Container className="flex min-h-9 items-center justify-center gap-6 lg:min-h-11 lg:justify-between">
        {lines.length > 0 && (
          <ul aria-label={words.announcements} className="flex min-w-0 items-center gap-6 py-2">
            {lines.map((line, index) => (
              <li
                key={`${String(index)}:${line}`}
                className={index === 0 ? "text-center lg:text-left" : "hidden xl:block"}
              >
                {line}
              </li>
            ))}
          </ul>
        )}
        {wide && (
          <nav aria-label={words.links} className="ml-auto hidden items-center gap-2 lg:flex">
            {links.map((link) => (
              <a key={link.path} href={link.path} className="at-band-link px-2">
                {link.label}
              </a>
            ))}
            {phone && (
              <a href={phone.phoneHref ?? undefined} className="at-band-link tabular gap-2 px-2">
                <Phone className="size-4" aria-hidden="true" />
                {phone.phone}
              </a>
            )}
          </nav>
        )}
      </Container>
    </div>
  )
}
