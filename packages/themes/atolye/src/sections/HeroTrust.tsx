import type { TrustBadgeView } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"
import { TrustIcon } from "../parts/TrustIcon"

/** From 1024 px as many columns as badges (at most four): no empty box. */
const COLUMNS = ["lg:grid-cols-1", "lg:grid-cols-2", "lg:grid-cols-3", "lg:grid-cols-4"]

/**
 * The shop's trust badges in the opening: one floating box on the field
 * colour with the theme's float shadow (a hairline in its place when the
 * shop turns shadows off), each badge its icon in the shop's colour beside
 * its title and line; two by two on a phone, all in a row from 1024 px.
 */
export function HeroTrust({
  badges,
  label,
  className,
}: {
  badges: readonly TrustBadgeView[]
  label: string
  /** The box's width and place in its opening (a blended one centres it). */
  className?: string | undefined
}) {
  return (
    <ul
      aria-label={label}
      className={cn(
        "grid grid-cols-2 gap-x-4 gap-y-5 rounded-tile bg-field px-4 py-5 text-left text-text shadow-float sm:px-6 lg:gap-x-0 lg:px-2",
        COLUMNS[Math.min(badges.length, COLUMNS.length) - 1],
        className
      )}
    >
      {badges.map((badge) => (
        <li
          key={badge.title}
          className="flex items-start gap-3 last:odd:col-span-2 lg:border-l lg:border-rule lg:px-6 lg:first:border-l-0 lg:last:odd:col-span-1"
        >
          <TrustIcon icon={badge.icon} className="size-7 shrink-0 text-signal" />
          <span className="flex min-w-0 flex-col gap-0.5 leading-snug">
            <span className="text-sm font-extrabold tracking-[-0.01em] text-balance">
              {badge.title}
            </span>
            {badge.text && <span className="text-xs text-balance text-text-2">{badge.text}</span>}
          </span>
        </li>
      ))}
    </ul>
  )
}
