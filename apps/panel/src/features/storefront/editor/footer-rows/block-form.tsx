import {
  FOOTER_IMAGE_WIDTHS,
  FOOTER_LOGO_SIZES,
  FOOTER_NEWSLETTER_VARIANTS,
  FOOTER_TEXT_STYLES,
  FOOTER_TRUST_LAYOUTS,
  SECTION_DEVICES,
} from "@qticaret/types"
import { NamedGroup } from "../named-group"
import { StepChoice } from "../forms/step-choice"
import { BlockContent } from "./block-content"
import { BlockSwitch } from "./block-kit"
import { useBlockKit } from "./use-block-kit"
import type { BlockFormProps } from "./use-block-kit"
import { FR } from "./footer-rows-fields"
import type { BlockField } from "./footer-rows-fields"

/**
 * A block's settings in a section's three tabs (adr/0065 Ek, adr/0070
 * §7): its words and what it shows under "İçerik" (open), how it is drawn
 * under "Stil" (the newsletter's variant, a picture's width, the badges'
 * line, a text's hand face, the logo's size, a menu folding on a phone), whether and on which screens it shows
 * under "Gelişmiş". Each group stands where `panel-groups.ts` says.
 */
export function BlockForm({
  menus,
  ...props
}: BlockFormProps & { menus: readonly string[] | null }) {
  const kit = useBlockKit(props)
  const { t } = kit
  const { block, onChange } = props
  const steps = <S extends string>(
    field: BlockField,
    list: readonly S[],
    value: S,
    set: (step: S) => void
  ) => (
    <StepChoice
      id={kit.id(field)}
      {...kit.names(field)}
      hint={field === "device" ? t(`${FR}.fields.device.hint`) : undefined}
      steps={list}
      value={value}
      fallback={list[0] ?? value}
      nameOf={(step) => t(`${FR}.fields.${field}.${step}`)}
      onChange={set}
    />
  )
  return (
    <>
      <NamedGroup name="content">
        <div className="flex flex-col gap-5">
          <BlockContent {...props} menus={menus} />
        </div>
      </NamedGroup>
      {block.type === "newsletter" ? (
        <NamedGroup name="variant">
          {steps("variant", FOOTER_NEWSLETTER_VARIANTS, block.variant, (variant) => {
            onChange({ ...block, variant })
          })}
        </NamedGroup>
      ) : null}
      {block.type === "image" || block.type === "trust" ? (
        <NamedGroup name="appearance">
          {block.type === "image"
            ? steps("width", FOOTER_IMAGE_WIDTHS, block.width, (width) => {
                onChange({ ...block, width })
              })
            : steps("layout", FOOTER_TRUST_LAYOUTS, block.layout, (layout) => {
                onChange({ ...block, layout })
              })}
        </NamedGroup>
      ) : null}
      {block.type === "text" ? (
        <NamedGroup name="appearance">
          {steps("style", FOOTER_TEXT_STYLES, block.style, (style) => {
            onChange({ ...block, style })
          })}
        </NamedGroup>
      ) : null}
      {block.type === "brand" ? (
        <NamedGroup name="appearance">
          {steps("logo_size", FOOTER_LOGO_SIZES, block.logo_size, (logo_size) => {
            onChange({ ...block, logo_size })
          })}
        </NamedGroup>
      ) : null}
      {block.type === "menu" ? (
        <NamedGroup name="phone">
          <BlockSwitch
            block={block}
            problems={props.problems}
            onChange={onChange}
            field="collapse_phone"
            hint={t(`${FR}.fields.collapse_phone.hint`)}
          />
        </NamedGroup>
      ) : null}
      <NamedGroup name="visibility">
        <div className="flex flex-col gap-5">
          <BlockSwitch {...props} field="visible" />
          {steps("device", SECTION_DEVICES, block.device, (device) => {
            onChange({ ...block, device })
          })}
        </div>
      </NamedGroup>
    </>
  )
}
