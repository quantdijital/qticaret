/**
 * The shop's short lines above the header. Nothing moves on its own (WCAG
 * 2.2.2): a phone shows the first line, a wide screen all of them.
 */
export function AnnouncementBar({ lines, label }: { lines: string[]; label: string }) {
  if (lines.length === 0) {
    return null
  }
  return (
    <aside
      aria-label={label}
      className="bg-announcement text-announcement-foreground text-center text-xs font-medium tracking-wide"
    >
      <ul className="mx-auto flex max-w-7xl justify-center gap-8 px-4 py-2">
        {lines.map((line, index) => (
          <li key={`${index}:${line}`} className={index === 0 ? undefined : "hidden md:block"}>
            {line}
          </li>
        ))}
      </ul>
    </aside>
  )
}
