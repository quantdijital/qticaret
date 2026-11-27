import type { FooterBarView, SocialLinkView } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"
import { SocialGlyph } from "../parts/SocialGlyph"

const FACE =
  "inline-flex min-h-11 items-center rounded-button border border-rule bg-field no-underline hover:border-edge"

/**
 * The shop's profiles in the contact column (its store details' social
 * accounts): written names on pills as before, or, as the footer's
 * `social` asks (adr/0049 Ek 2026-11-15), a row of 44 px round signs each
 * named by its network for a screen reader; or not at all. Each opens in
 * a new tab, with no referrer, as the shop's own (`me`).
 */
export function FooterSocial({
  profiles,
  style,
  label,
}: {
  profiles: readonly SocialLinkView[]
  style: NonNullable<FooterBarView["social"]>
  label: string
}) {
  if (profiles.length === 0 || style === "hidden") {
    return null
  }
  // `bare`: the glyphs alone, no ring or field (the icons' room to tap kept)
  const bare = style === "bare"
  const icons = style === "icons" || bare
  return (
    <ul aria-label={label} className={cn("flex flex-wrap", bare ? "-ml-3 gap-1" : "gap-2")}>
      {profiles.map((profile) => (
        <li key={profile.href}>
          <a
            href={profile.href}
            rel="noopener noreferrer me"
            target="_blank"
            aria-label={icons ? profile.label : undefined}
            className={cn(
              bare
                ? "inline-flex size-11 items-center justify-center rounded-pill text-text no-underline hover:text-text-2"
                : FACE,
              !bare &&
                (icons
                  ? "size-11 justify-center rounded-pill text-text"
                  : "px-4 text-sm font-semibold")
            )}
          >
            {icons ? (
              <SocialGlyph network={profile.network} label={profile.label} />
            ) : (
              profile.label
            )}
          </a>
        </li>
      ))}
    </ul>
  )
}
