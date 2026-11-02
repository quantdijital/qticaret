import type { ReactNode } from "react"
import { Controller } from "react-hook-form"
import type { Control } from "react-hook-form"
import { useTranslation } from "react-i18next"
import {
  BODY_FONTS,
  BUTTON_SHAPES,
  CARD_RATIOS,
  HEADER_LAYOUTS,
  HEADING_FONTS,
  RADII,
  SERIF_FONTS,
} from "@/features/storefront/api/theme"
import type { BodyFont, HeadingFont } from "@/features/storefront/api/theme"
import type { ThemeParsed, ThemeValues } from "@/features/storefront/theme-settings"
import { cn } from "@/lib/utils"
import { FieldGroup } from "./forms/fields"
import { ChoiceSelect, SwitchRow } from "./theme-fields"

const C = "storefront.editor.theme"

/**
 * Two choices side by side: short ones always (the panel is 340 px beside
 * the preview), long ones (the fonts' names) once the panel is wider.
 */
const Pair = ({ long = false, children }: { long?: boolean; children: ReactNode }) => (
  <div className={cn("grid gap-3", long ? "@sm:grid-cols-2" : "grid-cols-2")}>{children}</div>
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

/** The theme's fixed-list choices: faces, corners and buttons, the product card and the header. */
export function ThemeChoices({ control }: { control: Control<ThemeValues, unknown, ThemeParsed> }) {
  const { t } = useTranslation()
  return (
    <>
      <FieldGroup title={t(`${C}.fontsTitle`)} hint={t(`${C}.fontsHint`)}>
        <Pair long>
          <Controller
            control={control}
            name="typography.heading"
            render={({ field }) => (
              <ChoiceSelect
                id="theme-heading"
                label={t(`${C}.heading`)}
                value={field.value}
                options={HEADING_FONTS}
                onChange={field.onChange}
                render={(font) => <FontName font={font} />}
              />
            )}
          />
          <Controller
            control={control}
            name="typography.body"
            render={({ field }) => (
              <ChoiceSelect
                id="theme-body"
                label={t(`${C}.body`)}
                value={field.value}
                options={BODY_FONTS}
                onChange={field.onChange}
                render={(font) => <FontName font={font} />}
              />
            )}
          />
        </Pair>
      </FieldGroup>
      <FieldGroup title={t(`${C}.shapes`)}>
        <Pair>
          <Controller
            control={control}
            name="radius"
            render={({ field }) => (
              <ChoiceSelect
                id="theme-radius"
                label={t(`${C}.radius`)}
                value={field.value}
                options={RADII}
                onChange={field.onChange}
                render={(option) => t(`${C}.radii.${option}`)}
              />
            )}
          />
          <Controller
            control={control}
            name="buttons"
            render={({ field }) => (
              <ChoiceSelect
                id="theme-buttons"
                label={t(`${C}.buttons`)}
                value={field.value}
                options={BUTTON_SHAPES}
                onChange={field.onChange}
                render={(option) => t(`${C}.buttonShapes.${option}`)}
              />
            )}
          />
        </Pair>
      </FieldGroup>
      <FieldGroup title={t(`${C}.card`)}>
        <Pair>
          <Controller
            control={control}
            name="product_card.ratio"
            render={({ field }) => (
              <ChoiceSelect
                id="theme-ratio"
                label={t(`${C}.ratio`)}
                value={field.value}
                options={CARD_RATIOS}
                onChange={field.onChange}
                render={(option) => t(`${C}.ratios.${option.replace(":", "x")}`)}
              />
            )}
          />
          <Controller
            control={control}
            name="header.layout"
            render={({ field }) => (
              <ChoiceSelect
                id="theme-header"
                label={t(`${C}.headerLayout`)}
                value={field.value}
                options={HEADER_LAYOUTS}
                onChange={field.onChange}
                render={(option) => t(`${C}.headerLayouts.${option}`)}
              />
            )}
          />
        </Pair>
        {(["show_brand", "show_rating"] as const).map((name) => (
          <Controller
            key={name}
            control={control}
            name={`product_card.${name}`}
            render={({ field }) => (
              <SwitchRow
                id={`theme-${name}`}
                label={t(`${C}.${name}`)}
                hint={t(`${C}.${name}Hint`)}
                checked={field.value}
                onChange={field.onChange}
              />
            )}
          />
        ))}
        <Controller
          control={control}
          name="header.sticky"
          render={({ field }) => (
            <SwitchRow
              id="theme-sticky"
              label={t(`${C}.sticky`)}
              hint={t(`${C}.stickyHint`)}
              checked={field.value}
              onChange={field.onChange}
            />
          )}
        />
      </FieldGroup>
    </>
  )
}
