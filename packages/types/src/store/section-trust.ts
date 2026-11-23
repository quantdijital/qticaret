/**
 * The trust badges' `card` variant (adr/0077 §10 Ek, "ikonlu bölümler"):
 * the shop's badges in one white floating box, each its icon, title and
 * line, split by thin rules. Its one setting, `lift`: off, the box stands
 * in its own place as every section; on, it rises over the bottom of the
 * section before it (a picture opening, most often) and floats there. The
 * default is off, so a box switched to `card` stands where the strip stood.
 * A theme lifts it only when a section stands before it. The contract's
 * list: a new step goes here first, then into the backend's mirror
 * (`lib/storefront/sections/trust-badges.ts`, a test keeps them equal).
 *
 * Imports nothing at run time.
 */
export const TRUST_CARD_SETTINGS = {
  lift: ["off", "on"],
} as const satisfies Record<string, readonly [string, ...string[]]>

export type TrustCardSetting = keyof typeof TRUST_CARD_SETTINGS
export type TrustCardStep<S extends TrustCardSetting> = (typeof TRUST_CARD_SETTINGS)[S][number]

/** A section switched to `card`, and what a reader takes for a field it lacks. */
export const TRUST_CARD_DEFAULTS: { readonly [S in TrustCardSetting]: TrustCardStep<S> } = {
  lift: "off",
}

export type TrustCardSettings = { [S in TrustCardSetting]: TrustCardStep<S> }

/** The card's settings as a reader takes them: one missing or off the list reads as its default. */
export function trustCardSettingsOf(
  section: Partial<Record<TrustCardSetting, unknown>>
): TrustCardSettings {
  const steps: readonly unknown[] = TRUST_CARD_SETTINGS.lift
  return {
    lift: steps.includes(section.lift)
      ? (section.lift as TrustCardStep<"lift">)
      : TRUST_CARD_DEFAULTS.lift,
  }
}
