import type { StatsSectionView } from "@qticaret/ui"
import { SocialGlyph } from "../parts/SocialGlyph"

/**
 * The shop's social profiles at the figures row's end (`social: on`):
 * a small line ("Bizi izleyin") over round dark marks, each a link out
 * named for a screen reader by its network; a rule parts them from the
 * figures from 1024 px.
 */
export function StatsFollow({
  id,
  follow,
}: {
  id: string
  follow: NonNullable<StatsSectionView["follow"]>
}) {
  return (
    <div className="flex flex-col gap-2 lg:border-l lg:border-rule lg:pl-(--gap-columns)">
      <p id={id} className="text-xs font-semibold text-text-2">
        {follow.title}
      </p>
      <ul aria-labelledby={id} className="flex flex-wrap gap-2">
        {follow.profiles.map((profile) => (
          <li key={profile.href}>
            <a
              href={profile.href}
              rel="noopener noreferrer me"
              target="_blank"
              aria-label={profile.label}
              className="inline-flex size-8 items-center justify-center rounded-pill bg-text text-paper no-underline transition-colors hover:bg-text-2"
            >
              <SocialGlyph network={profile.network} label={profile.label} className="size-4" />
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}
