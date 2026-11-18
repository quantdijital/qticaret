/**
 * The style kit (adr/0067 §1): theme-wide identity steps a component reads
 * instead of drawing its own. Each is a theme setting (adr/0062) with named
 * steps, never a number or a colour; the first step of each list is its
 * default and today's drawing, and at the default the storefront prints
 * nothing. The contract's lists: the backend mirrors them
 * (`platform-settings/sections/theme-style-kit.ts`, a test keeps them
 * equal), the storefront marks a step off the default on the theme's root
 * element as `data-<field>` (`data-menu-style="plain"`), and the panel
 * names each step `storefront.editor.theme.styleKit.<field>.<step>`.
 *
 * `surface_style` (S5) came before the kit and stays its own field.
 */
export const STYLE_KIT = {
  /** S1: the desktop menu items' hover and open state; `filled` each header's drawing today. */
  menu_style: ["filled", "underline", "plain"],
  /** S2: floating surfaces (dropdowns, drawers, dialogs, the sticky header); `none` a 1 px rule instead. */
  shadow: ["float", "none"],
  /** S3: chips, tabs, option buttons and pages, unselected; the selected chip's fill stays. */
  chip_style: ["filled", "lined"],
  /** S4: the well behind a product's and a category's photo; `page` the page's own ground. */
  media_ground: ["well", "page"],
  /**
   * S6 (adr/0067 Ek 2026-11-16): the room under a section's heading, between a
   * grid's columns and rows and above the footer; `airy` today's.
   */
  density: ["airy", "balanced", "compact"],
  /**
   * S7 (adr/0067 Ek 2026-11-18): motion beyond the theme's own small
   * transitions; `lively` adds the cards' photo zoom and lift, a reveal as
   * content scrolls in, images fading in and a pressed button; `calm` today's.
   */
  motion: ["calm", "lively"],
} as const satisfies Record<string, readonly [string, ...string[]]>

export type StyleKitField = keyof typeof STYLE_KIT
export type StyleKitStep<F extends StyleKitField> = (typeof STYLE_KIT)[F][number]

/** The kit as the theme settings keep it: every field present. */
export type StyleKit = { [F in StyleKitField]: StyleKitStep<F> }

/** The fields in the contract's order (adr/0067 §1, S1 to S4; S6 its Ek 2026-11-16, S7 Ek 2026-11-18). */
export const STYLE_KIT_FIELDS = Object.keys(STYLE_KIT) as StyleKitField[]

/** Each field's default, its list's first step: today's drawing. */
export const STYLE_KIT_DEFAULTS: Readonly<StyleKit> = {
  menu_style: "filled",
  shadow: "float",
  chip_style: "filled",
  media_ground: "well",
  density: "airy",
  motion: "calm",
}

/** The attribute a step off the default is marked with on the theme's root element. */
export const styleKitAttribute = (field: StyleKitField): `data-${string}` =>
  `data-${field.replace(/_/g, "-")}`

/**
 * The kit's marks (adr/0067 §3b): each field off its default as a `data-*`
 * attribute for the theme's root element (`data-menu-style="plain"`,
 * `data-shadow="none"`, `data-chip-style="lined"`, `data-media-ground=
 * "page"`, `data-density="balanced"`, `data-motion="lively"`); nothing at a
 * default, so a page at today's drawing prints what it did before the kit.
 * A theme's stylesheet reads a step with an attribute selector over its
 * own (`[data-shadow="none"] .gf-drop`) or sets
 * a token there (`[data-shadow="none"] { --shadow-float: none }`); the
 * theme gives the same marks to the dialogs and drawers it portals to
 * `body` (adr/0067 Ek 2026-11-15). No kit: every default.
 */
export function styleKitAttributes(kit: Partial<StyleKit> | undefined): Record<string, string> {
  const marks: Record<string, string> = {}
  for (const field of STYLE_KIT_FIELDS) {
    const step = kit?.[field]
    if (step !== undefined && step !== STYLE_KIT_DEFAULTS[field]) {
      marks[styleKitAttribute(field)] = step
    }
  }
  return marks
}
