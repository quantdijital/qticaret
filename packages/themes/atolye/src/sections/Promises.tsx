import type { TrustBadgeView } from "@qticaret/ui"
import { Container } from "../parts/Container"
import { TrustIcon } from "../parts/TrustIcon"

/**
 * The shop's promises (its trust badges, at most four) right under the
 * opening; only what the shop wrote in its settings. On a phone (sahip
 * 2026-11-05: "mobilde çok düzenli olmamış") two by two equal cards, each
 * its icon on top, a one-line title and its line under it, so the titles
 * and lines start at the same height; from 640 px the icon beside the
 * text; from 1024 px four across in one tinted strip.
 */
export function Promises({ badges, label }: { badges: readonly TrustBadgeView[]; label: string }) {
  if (badges.length === 0) {
    return null
  }
  return (
    <section aria-label={label} className="pt-3 lg:pt-4">
      <Container>
        <ul className="grid auto-rows-fr grid-cols-2 gap-2 lg:grid-cols-4 lg:gap-(--gap-columns) lg:rounded-tile lg:bg-paper-2 lg:px-8 lg:py-5">
          {badges.map((badge) => (
            <li
              key={badge.title}
              className="flex flex-col items-start gap-2.5 rounded-media bg-paper-2 p-3 sm:flex-row sm:gap-3 lg:rounded-none lg:bg-transparent lg:p-0"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-pill bg-paper text-text sm:size-10 lg:size-11">
                <TrustIcon icon={badge.icon} className="size-5 shrink-0" />
              </span>
              <span className="flex min-w-0 flex-col gap-0.5 sm:gap-0">
                <span className="text-sm leading-snug font-extrabold tracking-[-0.01em] text-balance lg:text-md">
                  {badge.title}
                </span>
                {badge.text && (
                  <span className="text-xs leading-snug text-balance text-text-2 lg:text-sm">
                    {badge.text}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  )
}
