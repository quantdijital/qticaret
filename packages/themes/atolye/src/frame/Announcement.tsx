import { Phone } from "lucide-react"
import type { ContactView, LinkView } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"
import { Container } from "../parts/Container"

/**
 * The bar above the header, graphite: one message (the shop's first
 * line: its free-shipping threshold or campaign), centred on a phone; from
 * 1024 px the shop's small links and phone sit at its end. Without a line
 * a phone draws nothing; without lines, links or phone nothing is drawn.
 * Nothing moves on its own (WCAG 2.2.2).
 */
export function Announcement({
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
  const [line] = lines
  const phone = contact.phone && contact.phoneHref ? contact : null
  const wide = links.length > 0 || phone !== null
  if (!line && !wide) {
    return null
  }
  return (
    <div className={cn("gf-stage text-sm", !line && "max-lg:hidden")}>
      <Container className="flex min-h-9 items-center justify-center gap-6 lg:justify-between">
        {line && (
          <p
            aria-label={words.announcements}
            className="py-2 text-center font-semibold lg:text-left"
          >
            {line}
          </p>
        )}
        {wide && (
          <nav aria-label={words.links} className="ml-auto hidden items-center gap-1 lg:flex">
            {links.map((link) => (
              <a
                key={link.path}
                href={link.path}
                className="rounded-pill px-3 py-2 text-stage-text-2 no-underline hover:text-stage-text"
              >
                {link.label}
              </a>
            ))}
            {phone && (
              <a
                href={phone.phoneHref ?? undefined}
                className="tabular inline-flex items-center gap-2 rounded-pill px-3 py-2 font-semibold no-underline"
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
