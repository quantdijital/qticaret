import type { LinkView } from "@qticaret/ui"

/**
 * One of the bar's lines: its words, a link when the shop gave that line
 * one (`announcement_bar.line_links`, owner 2026-11-27), in the bar's own
 * ink, a shade lighter under the pointer (no underline on hover, owner
 * 2026-11-18).
 */
export function AnnouncementLine({
  line,
  link,
}: {
  line: string
  link?: LinkView | null | undefined
}) {
  if (!link) {
    return line
  }
  return (
    <a href={link.path} className="text-inherit no-underline hover:opacity-80">
      {line}
    </a>
  )
}
