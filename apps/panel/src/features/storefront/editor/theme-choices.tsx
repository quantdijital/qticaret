import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import type { AccentFont } from "@qticaret/types"
import {
  ACCENT_FONTS,
  BODY_FONTS,
  BUTTON_SHAPES,
  HEADING_FONTS,
  NO_LIRA_FONTS,
  RADII,
  SECTION_SPACINGS,
  SURFACE_STYLES,
  SERIF_FONTS,
  SINGLE_WEIGHT_FONTS,
} from "@/features/storefront/api/theme"
import type { BodyFont, HeadingFont, ThemeSettings } from "@/features/storefront/api/theme"
import { cn } from "@qticaret/admin-ui/lib/utils"
import { PanelGroup } from "./panel-header"
import { ChoiceSelect } from "./theme-fields"
import { ThemeCardGroups } from "./theme-card-fields"
import { KitChoice } from "./theme-style-kit-fields"
import { THEME_GROUP_TITLES, THEME_IDS } from "./forms/theme-registry"
import type { CardVariantsInUse, ThemeGroupName } from "./forms/theme-registry"

const C = "storefront.editor.theme"

/**
 * Two choices side by side once each gets 160 px or more (the group's
 * width: the settings column, or the whole screen on a phone), long ones
 * (the fonts' names) 200 px; one under the other below that.
 */
const Pair = ({ long = false, children }: { long?: boolean; children: ReactNode }) => (
  <div className={cn("grid gap-4", long ? "@min-[26rem]:grid-cols-2" : "@min-[21rem]:grid-cols-2")}>
    {children}
  </div>
)

/** A face by its name, and whether it is a serif: the panel does not load the storefront's fonts. */
function FontName({ font }: { font: HeadingFont | BodyFont }) {
  const { t } = useTranslation()
  return (
    <span className="flex items-baseline gap-2">
      {t(`${C}.fonts.${font}`)}
      <span className="text-xs text-muted-foreground">
        {t(SERIF_FONTS.has(font) ? `${C}.serif` : `${C}.sans`)}
      </span>
    </span>
  )
}

/** The accent faces that are serifs, not handwriting. */
const SERIF_ACCENTS: ReadonlySet<AccentFont> = new Set(["dm-serif", "fraunces", "playfair"])

/** An accent face by its name, marked handwriting or serif: "Yok" alone. */
function AccentName({ font }: { font: AccentFont }) {
  const { t } = useTranslation()
  return (
    <span className="flex items-baseline gap-2">
      {t(`${C}.accentFonts.${font}`)}
      {font === "none" ? null : (
        <span className="text-xs text-muted-foreground">
          {t(SERIF_ACCENTS.has(font) ? `${C}.serif` : `${C}.handwriting`)}
        </span>
      )}
    </span>
  )
}

/**
 * What to know about a heading face before choosing it (adr/0062 §7): no ₺
 * in its files, one weight only. Nothing for the others.
 */
function useHeadingNote(): (font: HeadingFont) => string | undefined {
  const { t } = useTranslation()
  return (font) => {
    const notes = [
      NO_LIRA_FONTS.has(font) ? t(`${C}.fontNotes.noLira`) : null,
      SINGLE_WEIGHT_FONTS.has(font) ? t(`${C}.fontNotes.singleWeight`) : null,
    ].filter((note) => note !== null)
    return notes.length > 0 ? notes.join(" ") : undefined
  }
}

interface ThemeChoicesProps {
  theme: ThemeSettings
  /** The card variants the draft draws: a field meaningless for all of them is hidden. */
  variants: CardVariantsInUse
  /** A group to open now (the settings search's pick); null: none. */
  reveal: (group: ThemeGroupName) => number | null
  /** The theme with one choice changed: the draft takes it at once (adr/0063 §3). */
  onChange: (theme: ThemeSettings) => void
}

/**
 * The theme's fixed-list choices: faces, shapes (corners, buttons, chips),
 * spacing (between sections, the density), surfaces (boxes, shadow, the
 * photos' ground, menu items, motion; adr/0067 §2.7 and its Ek 2026-11-16
 * and 2026-11-18), the
 * product card. The header's layout and stickiness are the header bar's now
 * (adr/0049 Ek 2026-11-14 §5), in the tree under "Üst bilgi".
 */
export function ThemeChoices({ theme, variants, reveal, onChange }: ThemeChoicesProps) {
  const { t } = useTranslation()
  const headingNote = useHeadingNote()
  const { typography } = theme
  // A style kit field's props (adr/0067): hidden until the storefront draws it
  const kit = { theme, variants, onChange }
  return (
    <>
      <PanelGroup
        name="fonts"
        title={t(THEME_GROUP_TITLES.fonts)}
        hint={t(`${C}.fontsHint`)}
        reveal={reveal("fonts")}
      >
        <Pair long>
          <ChoiceSelect
            id={THEME_IDS["typography.heading"]}
            label={t(`${C}.heading`)}
            term={t(`${C}.fontTerm`)}
            value={typography.heading}
            options={HEADING_FONTS}
            onChange={(value) => {
              onChange({ ...theme, typography: { ...typography, heading: value } })
            }}
            render={(font) => <FontName font={font} />}
            note={headingNote(typography.heading)}
          />
          <ChoiceSelect
            id={THEME_IDS["typography.body"]}
            label={t(`${C}.body`)}
            term={t(`${C}.fontTerm`)}
            value={typography.body}
            options={BODY_FONTS}
            onChange={(value) => {
              onChange({ ...theme, typography: { ...typography, body: value } })
            }}
            render={(font) => <FontName font={font} />}
          />
        </Pair>
        <ChoiceSelect
          id={THEME_IDS["typography.accent"]}
          label={t(`${C}.accentFont`)}
          term={t(`${C}.accentFontTerm`)}
          value={typography.accent ?? "none"}
          options={ACCENT_FONTS}
          onChange={(value) => {
            // Written even as none: the draft holds the shop's own choice
            onChange({ ...theme, typography: { ...typography, accent: value } })
          }}
          render={(font) => <AccentName font={font} />}
          hint={t(`${C}.accentFontHint`)}
        />
        <KitChoice field="section_title" {...kit} />
        <KitChoice field="title_accent" {...kit} />
      </PanelGroup>
      <PanelGroup name="shapes" title={t(THEME_GROUP_TITLES.shapes)} reveal={reveal("shapes")}>
        <Pair>
          <ChoiceSelect
            id={THEME_IDS.radius}
            label={t(`${C}.radius`)}
            term={t(`${C}.radiusTerm`)}
            value={theme.radius}
            options={RADII}
            onChange={(value) => {
              onChange({ ...theme, radius: value })
            }}
            render={(option) => t(`${C}.radii.${option}`)}
            hint={t(`${C}.radiusHint`)}
          />
          <ChoiceSelect
            id={THEME_IDS.buttons}
            label={t(`${C}.buttons`)}
            value={theme.buttons}
            options={BUTTON_SHAPES}
            onChange={(value) => {
              onChange({ ...theme, buttons: value })
            }}
            render={(option) => t(`${C}.buttonShapes.${option}`)}
            hint={t(`${C}.buttonsHint`)}
          />
          <KitChoice field="chip_style" {...kit} />
        </Pair>
      </PanelGroup>
      <PanelGroup name="spacing" title={t(THEME_GROUP_TITLES.spacing)} reveal={reveal("spacing")}>
        <Pair>
          <ChoiceSelect
            id={THEME_IDS.section_spacing}
            label={t(`${C}.sectionSpacing`)}
            term={t(`${C}.sectionSpacingTerm`)}
            value={theme.section_spacing}
            options={SECTION_SPACINGS}
            onChange={(value) => {
              onChange({ ...theme, section_spacing: value })
            }}
            render={(option) => t(`${C}.sectionSpacings.${option}`)}
            hint={t(`${C}.sectionSpacingHint`)}
          />
          <KitChoice field="density" {...kit} />
          <KitChoice field="page_width" {...kit} />
        </Pair>
      </PanelGroup>
      <PanelGroup
        name="surfaces"
        title={t(THEME_GROUP_TITLES.surfaces)}
        reveal={reveal("surfaces")}
      >
        <Pair>
          <ChoiceSelect
            id={THEME_IDS.surface_style}
            label={t(`${C}.surfaceStyle`)}
            term={t(`${C}.surfaceStyleTerm`)}
            value={theme.surface_style}
            options={SURFACE_STYLES}
            onChange={(value) => {
              onChange({ ...theme, surface_style: value })
            }}
            render={(option) => t(`${C}.surfaceStyles.${option}`)}
            hint={t(`${C}.surfaceStyleHint`)}
          />
          <KitChoice field="shadow" {...kit} />
          <KitChoice field="media_ground" {...kit} />
          <KitChoice field="menu_style" {...kit} />
          <KitChoice field="motion" {...kit} />
        </Pair>
      </PanelGroup>
      <ThemeCardGroups theme={theme} variants={variants} reveal={reveal} onChange={onChange} />
    </>
  )
}
