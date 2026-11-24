import type { HandNoteView } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"

/**
 * A section's hand note (sahip 2026-11-24, "el yazısı not"): the shop's
 * short line over the heading, a little tilted, like a note written on
 * the page. In the shop's accent face when it chose one (`--font-accent`,
 * a size up: a handwriting face is small on its body); else the theme's
 * own face in italics, so the note reads without any face of its own. A
 * plain paragraph a screen reader reads as written; its ink is the
 * caller's (the heading's own, readable on its ground). Utility classes
 * only: the theme's stylesheets, kept by the preset lock, stay as they are.
 */
export function HandNote({
  note,
  className,
  mark,
}: {
  note: HandNoteView
  className?: string
  /** The editor's field mark (adr/0065 Faz 2b). */
  mark?: { "data-qf"?: string }
}) {
  return (
    <p
      {...mark}
      data-hand={note.hand ? "" : undefined}
      className={cn(
        "block w-fit max-w-full -rotate-2 leading-tight text-balance",
        note.hand
          ? "font-(family-name:--font-accent) text-2xl font-normal lg:text-3xl"
          : "text-lg font-medium italic lg:text-xl",
        className
      )}
    >
      {note.text}
    </p>
  )
}
