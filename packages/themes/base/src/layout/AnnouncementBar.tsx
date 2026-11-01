import { Phone } from "lucide-react"
import type { ContactView, LinkView } from "@qticaret/ui"
import { Container } from "../components/Container"

/**
 * The thin bar above the header: the shop's short lines on the left, its
 * small links and phone on the right (wide screens). Nothing moves on its
 * own (WCAG 2.2.2): a phone shows the first line only.
 */
export function AnnouncementBar({
  lines,
  links,
  contact,
  words,
}: {
  lines: string[]
  links: LinkView[]
  contact: ContactView
  words: { announcements: string; links: string }
}) {
  const phone = contact.phone && contact.phoneHref ? contact : null
  if (lines.length === 0 && links.length === 0 && !phone) {
    return null
  }
  return (
    <div className="bg-announcement text-announcement-foreground text-xs">
      <Container className="flex min-h-9 items-center justify-center gap-6 py-2 lg:justify-between">
        {lines.length > 0 && (
          <ul aria-label={words.announcements} className="flex items-center gap-6 font-medium">
            {lines.map((line, index) => (
              <li
                key={`${String(index)}:${line}`}
                className={
                  index === 0
                    ? "text-center"
                    : "hidden before:mr-6 before:opacity-50 before:content-['·'] xl:block"
                }
              >
                {line}
              </li>
            ))}
          </ul>
        )}
        {(links.length > 0 || phone) && (
          <nav aria-label={words.links} className="ml-auto hidden items-center gap-5 lg:flex">
            {links.map((link) => (
              <a key={link.path} href={link.path} className="opacity-85 hover:opacity-100">
                {link.label}
              </a>
            ))}
            {phone && (
              <a
                href={phone.phoneHref ?? undefined}
                className="flex items-center gap-1.5 font-semibold tabular"
              >
                <Phone className="size-3.5" aria-hidden="true" />
                {phone.phone}
              </a>
            )}
          </nav>
        )}
      </Container>
    </div>
  )
}
