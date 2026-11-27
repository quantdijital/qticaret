/**
 * A section's small upper-case line over its heading ("POPÜLER ROTALAR"),
 * spaced wide like the cover's (`HeroFull`). Drawn only where the shop
 * wrote one; the heading stays the section's name for a screen reader.
 */
export function Eyebrow({ text, mark }: { text: string; mark?: { "data-qf"?: string } }) {
  return (
    <p {...mark} className="text-xs font-semibold tracking-[0.18em] text-text-2 uppercase">
      {text}
    </p>
  )
}
