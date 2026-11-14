import type { MarqueeItemView, MarqueeSectionView, Translate } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"
import { Container } from "../parts/Container"
import { TrustIcon } from "../parts/TrustIcon"
import { loopOf } from "./marquee-loop"
import { MarqueeToggle } from "./MarqueeToggle"

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
 * by its size so nothing below moves (CLS). On a page it stands edge to
 * edge, or in the container with rounded corners when the shop boxed it;
 * in the header it is a band above the shop's header.
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
  const strip = (
    <section
      aria-label={t("marquee.label")}
      data-marquee=""
      data-size={section.size}
      data-ground={section.ground}
      data-speed={section.speed}
      data-direction={section.direction}
      data-separator={section.separator}
      data-span={span}
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
    </section>
  )
  if (header) {
    return strip
  }
  return (
    <div className="pt-(--section-gap-s)">{boxed ? <Container>{strip}</Container> : strip}</div>
  )
}
