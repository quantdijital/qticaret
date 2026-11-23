import { fieldKey, fieldMark } from "@qticaret/ui"
import type { TrustBadgeView } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"
import { Container } from "../parts/Container"
import { TrustIcon } from "../parts/TrustIcon"

/** From 1024 px as many columns as badges (at most four): no empty box. */
const COLUMNS = ["lg:grid-cols-1", "lg:grid-cols-2", "lg:grid-cols-3", "lg:grid-cols-4"]

/**
 * The trust badges' card (adr/0077 §10 Ek, "Kart"): the shop's badges in
 * one floating box on the field colour with the theme's float shadow (a
 * hairline in its place when the shop turns shadows off), each its icon in
 * the shop's colour beside its title and line; two by two on a phone, all
 * in a row from 1024 px, split there by short upright rules that stop
 * short of the box's edge. A thin strip (`data-thin`) as the others.
 *
 * Lifted (`lift`, only with a section before it): the section gives up its
 * gap above and the box rises `--promise-lift` over the bottom of the
 * section before it (a picture opening, most often), drawn over it
 * (`--z-raised`); a negative margin, so the page keeps its flow and
 * nothing after it moves. Right under a picture opening without the lift,
 * it keeps close to it as the strip does (`hug`).
 */
export function Card({
  badges,
  label,
  marks,
  hug,
  lift,
}: {
  badges: readonly TrustBadgeView[]
  label: string
  marks?: boolean | undefined
  hug: boolean
  lift: boolean
}) {
  return (
    <section
      aria-label={label}
      data-thin=""
      data-lift={lift ? "" : undefined}
      className={cn(
        lift ? "relative z-(--z-raised) [--promise-lift:2rem] lg:[--promise-lift:3rem]" : null,
        lift ? "pt-0" : hug ? "pt-3 lg:pt-4" : "gf-section"
      )}
    >
      <Container>
        <ul
          data-variant="card"
          className={cn(
            "grid grid-cols-2 gap-x-4 gap-y-5 rounded-tile bg-field px-4 py-5 shadow-float sm:px-6 lg:gap-x-0 lg:px-2 lg:py-6",
            COLUMNS[Math.min(badges.length, COLUMNS.length) - 1],
            lift && "-mt-(--promise-lift)"
          )}
        >
          {badges.map((badge, index) => (
            <li
              key={badge.title}
              className="flex items-start gap-3 last:odd:col-span-2 lg:border-l lg:border-rule lg:px-6 lg:first:border-l-0 lg:last:odd:col-span-1"
            >
              <TrustIcon icon={badge.icon} className="size-7 shrink-0 text-signal lg:size-8" />
              <span className="flex min-w-0 flex-col gap-0.5 leading-snug">
                <span
                  className="text-sm font-extrabold tracking-[-0.01em] text-balance lg:text-md"
                  {...fieldMark(marks, fieldKey("badges", index, "title"))}
                >
                  {badge.title}
                </span>
                {badge.text && (
                  <span
                    className="text-xs text-balance text-text-2"
                    {...fieldMark(marks, fieldKey("badges", index, "text"))}
                  >
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
