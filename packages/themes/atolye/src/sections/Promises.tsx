import type { TrustBadgeView } from "@qticaret/ui"
import { Container } from "../parts/Container"
import { TrustIcon } from "../parts/TrustIcon"

/**
 * The shop's promises (its trust badges, at most four) right under the
 * opening: one tinted strip, each promise its icon beside its title and
 * line; two by two on a phone, four across from 1024 px. Only what the
 * shop wrote in its settings.
 */
export function Promises({ badges, label }: { badges: readonly TrustBadgeView[]; label: string }) {
  if (badges.length === 0) {
    return null
  }
  return (
    <section aria-label={label} className="pt-3 lg:pt-4">
      <Container>
        <ul className="grid grid-cols-2 gap-2 lg:grid-cols-4 lg:gap-(--gap-columns) lg:rounded-tile lg:bg-paper-2 lg:px-8 lg:py-5">
          {badges.map((badge) => (
            <li
              key={badge.title}
              className="flex items-start gap-3 rounded-media bg-paper-2 p-3 lg:rounded-none lg:bg-transparent lg:p-0"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-pill bg-paper text-text lg:size-11">
                <TrustIcon icon={badge.icon} className="size-5 shrink-0" />
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="text-sm leading-snug font-extrabold lg:text-md">
                  {badge.title}
                </span>
                {badge.text && (
                  <span className="text-xs leading-snug text-text-2 lg:text-sm">{badge.text}</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  )
}
