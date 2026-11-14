import type { MarqueeItemView, MarqueeSectionView, Translate } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"
import { Container } from "../parts/Container"
import { TrustIcon } from "../parts/TrustIcon"
import { loopOf, outlined } from "./marquee-loop"
import { MarqueeClose } from "./MarqueeClose"
import { MarqueeToggle } from "./MarqueeToggle"

/**
 * The key a closed strip is remembered by: its id and a digest of its
 * words, so a strip the shop rewrites shows again (FNV-1a, not a secret).
 */
export function closedKey(section: MarqueeSectionView): string {
  let hash = 0x811c9dc5
  for (const char of section.items
    .map((item) => `${item.text}\u0000${item.subtext ?? ""}`)
    .join("\u0001")) {
    hash = Math.imul(hash ^ (char.codePointAt(0) ?? 0), 0x01000193)
  }
  return `gf-marquee:${section.id}:${(hash >>> 0).toString(36)}`
}

/**
 * One item: its icon, its line and second line, the whole a link when it
 * has one. A round that only fills the screen (`loop`) is hidden and inert.
 */
function Item({ item, loop = false }: { item: MarqueeItemView; loop?: boolean }) {
  const body = (
    <>
      {item.icon && <TrustIcon icon={item.icon} className="gf-marquee-icon" />}
      <span className="gf-marquee-words">
        <span data-part="text" className="gf-marquee-text">
          {item.text}
        </span>
        {item.subtext && <span className="gf-marquee-sub">{item.subtext}</span>}
      </span>
    </>
  )
  return (
    <li
      data-part="item"
      className="gf-marquee-item"
      {...(loop ? { "data-loop": "", "aria-hidden": true, inert: true } : {})}
    >
      {item.link ? (
        <a href={item.link.path} className="gf-marquee-link">
          {body}
        </a>
      ) : (
        <span className="gf-marquee-link">{body}</span>
      )}
    </li>
  )
}

/**
 * The scrolling strip (adr/0049 Ek 2026-11-14 §4.1; KY1, KY3): a band of
 * the shop's short lines sliding sideways, with CSS only (`marquee.css`).
 * Each item is written once for assistive tech; the rounds that fill a
 * wide screen and the loop's second copy are `aria-hidden` and `inert`.
 * It stops under the pointer and while focus is in it (a focused link
 * scrolls into view), and its pause button holds it (WCAG 2.2.2); under
 * `prefers-reduced-motion` it does not move and its items wrap. Its size,
 * ground, speed, direction and separator are attributes, its height fixed
 * by its size so nothing below moves (CLS). Its newer settings (adr/0049
 * Ek 2026-11-15: whether the pointer stops it, when the pause button shows,
 * weight, capitals, room, large outlined items, the screens it shows on
 * and a close button) are attributes too; the screens and a closed strip
 * take its outermost box (`data-mq-shell`) off the page, so a hidden strip
 * leaves no gap. On a page it stands edge to edge, or in the container
 * with rounded corners when the shop boxed it; in the header it is a band
 * above the shop's header.
 */
export function Marquee({
  section,
  t,
  boxed = false,
  header = false,
}: {
  section: MarqueeSectionView
  t: Translate
  /** The shop set the look's width to the container or the reading measure. */
  boxed?: boolean
  /** Above the shop's header: no gap of its own. */
  header?: boolean
}) {
  const { items } = section
  const { rounds, span } = loopOf(section)
  const repeats = Array.from({ length: rounds - 1 }, (_, round) => round)
  // The outermost box carries what takes the strip off the page
  const shell = { "data-mq-shell": "", "data-device": section.device }
  const strip = (
    <section
      aria-label={t("marquee.label")}
      data-marquee=""
      data-size={section.size}
      data-ground={section.ground}
      data-speed={section.speed}
      data-direction={section.direction}
      data-separator={section.separator}
      data-hover-pause={section.hover_pause}
      data-pause-button={section.pause_button}
      data-weight={section.weight}
      data-uppercase={section.uppercase}
      data-gap={section.gap}
      data-outline={outlined(section) ? "on" : undefined}
      data-span={span}
      {...(header ? shell : {})}
      className={cn(
        "gf-marquee",
        section.ground === "stage" && "gf-stage",
        boxed && "gf-marquee--boxed"
      )}
    >
      <div className="gf-marquee-view">
        <div className="gf-marquee-track">
          <ul className="gf-marquee-copy">
            {items.map((item, index) => (
              <Item key={index} item={item} />
            ))}
            {repeats.map((round) =>
              items.map((item, index) => (
                <Item key={`${String(round)}-${String(index)}`} item={item} loop />
              ))
            )}
          </ul>
          <ul className="gf-marquee-copy" aria-hidden="true" inert data-loop="">
            {[...repeats, rounds - 1].map((round) =>
              items.map((item, index) => (
                <Item key={`${String(round)}-${String(index)}`} item={item} />
              ))
            )}
          </ul>
        </div>
      </div>
      <MarqueeToggle pause={t("marquee.pause")} play={t("marquee.play")} />
      {section.closable === "on" && (
        <MarqueeClose label={t("marquee.close")} storageKey={closedKey(section)} />
      )}
    </section>
  )
  if (header) {
    return strip
  }
  return (
    <div className="pt-(--section-gap-s)" {...shell}>
      {boxed ? <Container>{strip}</Container> : strip}
    </div>
  )
}
