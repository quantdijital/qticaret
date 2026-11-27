import { UserRound } from "lucide-react"
import { fieldMark, sectionMark } from "@qticaret/ui"
import type { HeaderCatalogView, LinkView } from "@qticaret/ui"
import { Container } from "../parts/Container"

/** The note at the strip's start: small and quiet, one line (an ellipsis when long). */
const NOTE = "mr-auto min-w-0 truncate pr-3 text-text"

/**
 * The light top strip from 1024 px (adr/0049 Ek 2026-11-14 N14, Ek
 * 2026-11-15; the catalog header's own until the top strip became its own
 * section, owner 2026-11-27, `TopStrip`), drawn at the top of the header: the shop's note at its start (a link when it goes
 * somewhere), the shop's top links while they stand here, "Hesabım" at its
 * end. Without a note the links open the strip and "Hesabım" closes it, as
 * drawn before the note; with one, the links stand right before "Hesabım".
 * It folds away while the page scrolls down (`ScrollCue`, `data-gf-strip`).
 */
export function HeaderCatalogStrip({
  note,
  links,
  account,
  mark,
  words,
}: {
  note: NonNullable<HeaderCatalogView["stripNote"]> | null
  links: readonly LinkView[]
  /** "Hesabım" written at the end; null: not here. */
  account: string | null
  /**
   * The strip section's id in the live editor's preview (adr/0065 §9): the
   * strip carries its section mark and the note its line's field mark.
   */
  mark?: string | undefined
  words: { links: string }
}) {
  return (
    <div
      data-gf-strip=""
      {...sectionMark(mark)}
      className="hidden border-b border-rule bg-paper-2 text-xs lg:block"
    >
      <Container className="flex min-h-9 items-center">
        {note &&
          (note.path ? (
            <a
              href={note.path}
              // Underlined as the page's links are: it reads as one; 36 px tall as the strip's others
              className={`${NOTE} leading-9 underline pointer-coarse:leading-11`}
              {...fieldMark(mark !== undefined, "lines.0")}
            >
              {note.text}
            </a>
          ) : (
            <p className={NOTE} {...fieldMark(mark !== undefined, "lines.0")}>
              {note.text}
            </p>
          ))}
        {links.length > 0 && (
          <nav
            aria-label={words.links}
            // With a note, the links keep one line at the end: the note gives way first
            className={
              note
                ? `flex shrink-0 items-center${account === null ? " -mr-3" : ""}`
                : "-ml-3 flex flex-wrap items-center"
            }
          >
            {links.map((link) => (
              <a
                key={link.path}
                href={link.path}
                className="inline-flex min-h-9 items-center rounded-button px-3 text-text-2 no-underline pointer-coarse:min-h-11 hover:text-text"
              >
                {link.label}
              </a>
            ))}
          </nav>
        )}
        {account !== null && (
          <a
            href="/hesap"
            className={
              // With a note it already stands at the end, right after the links
              note
                ? "-mr-3 inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-button px-3 font-semibold text-text no-underline pointer-coarse:min-h-11"
                : "-mr-3 ml-auto inline-flex min-h-9 items-center gap-1.5 rounded-button px-3 font-semibold text-text no-underline pointer-coarse:min-h-11"
            }
          >
            <UserRound className="size-4" aria-hidden="true" strokeWidth={2} />
            {account}
          </a>
        )}
      </Container>
    </div>
  )
}
