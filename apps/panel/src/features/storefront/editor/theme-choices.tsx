import type { ReactNode } from "react"
import { useTranslation } from "react-i18next"
import {
  BODY_FONTS,
  BUTTON_SHAPES,
  CARD_RATIOS,
  HEADING_FONTS,
  NO_LIRA_FONTS,
  RADII,
  SERIF_FONTS,
  SINGLE_WEIGHT_FONTS,
} from "@/features/storefront/api/theme"
import type { BodyFont, HeadingFont, ThemeSettings } from "@/features/storefront/api/theme"
import { cn } from "@qticaret/admin-ui/lib/utils"
import { PanelGroup } from "./panel-header"
import { ChoiceSelect, SwitchRow } from "./theme-fields"

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
  /** The theme with one choice changed: the draft takes it at once (adr/0063 §3). */
  onChange: (theme: ThemeSettings) => void
}

/**
 * The theme's fixed-list choices: faces, corners and buttons, the product
 * card. The header's layout and stickiness are the header bar's now
 * (adr/0049 Ek 2026-11-14 §5), in the tree under "Üst bilgi".
 */
export function ThemeChoices({ theme, onChange }: ThemeChoicesProps) {
  const { t } = useTranslation()
  const headingNote = useHeadingNote()
  const { typography, product_card: card } = theme
  return (
    <>
      <PanelGroup title={t(`${C}.fontsTitle`)} hint={t(`${C}.fontsHint`)}>
        <Pair long>
          <ChoiceSelect
            id="theme-heading"
            label={t(`${C}.heading`)}
            value={typography.heading}
            options={HEADING_FONTS}
            onChange={(value) => {
              onChange({ ...theme, typography: { ...typography, heading: value } })
            }}
            render={(font) => <FontName font={font} />}
            hint={headingNote(typography.heading)}
          />
          <ChoiceSelect
            id="theme-body"
            label={t(`${C}.body`)}
            value={typography.body}
            options={BODY_FONTS}
            onChange={(value) => {
              onChange({ ...theme, typography: { ...typography, body: value } })
            }}
            render={(font) => <FontName font={font} />}
          />
        </Pair>
      </PanelGroup>
      <PanelGroup title={t(`${C}.shapes`)}>
        <Pair>
          <ChoiceSelect
            id="theme-radius"
            label={t(`${C}.radius`)}
            value={theme.radius}
            options={RADII}
            onChange={(value) => {
              onChange({ ...theme, radius: value })
            }}
            render={(option) => t(`${C}.radii.${option}`)}
            hint={t(`${C}.radiusHint`)}
          />
          <ChoiceSelect
            id="theme-buttons"
            label={t(`${C}.buttons`)}
            value={theme.buttons}
            options={BUTTON_SHAPES}
            onChange={(value) => {
              onChange({ ...theme, buttons: value })
            }}
            render={(option) => t(`${C}.buttonShapes.${option}`)}
            hint={t(`${C}.buttonsHint`)}
          />
        </Pair>
      </PanelGroup>
      <PanelGroup title={t(`${C}.card`)}>
        <Pair>
          <ChoiceSelect
            id="theme-ratio"
            label={t(`${C}.ratio`)}
            value={card.ratio}
            options={CARD_RATIOS}
            onChange={(value) => {
              onChange({ ...theme, product_card: { ...card, ratio: value } })
            }}
            render={(option) => t(`${C}.ratios.${option.replace(":", "x")}`)}
            hint={t(`${C}.ratioHint`)}
          />
        </Pair>
        {(["show_brand", "show_rating"] as const).map((name) => (
          <SwitchRow
            key={name}
            id={`theme-${name}`}
            label={t(`${C}.${name}`)}
            hint={t(`${C}.${name}Hint`)}
            checked={card[name]}
            onChange={(value) => {
              onChange({ ...theme, product_card: { ...card, [name]: value } })
            }}
          />
        ))}
      </PanelGroup>
    </>
  )
}
