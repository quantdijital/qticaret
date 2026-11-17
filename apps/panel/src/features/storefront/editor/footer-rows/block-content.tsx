import { FOOTER_ROWS_LIMITS as L, FOOTER_TRUST_LIMIT, NEWSLETTER_LIMITS } from "@qticaret/types"
import type { FooterBlock } from "@/features/storefront/api/layout"
import { CountField, TextField } from "../forms/fields"
import { ImageField } from "../forms/image-field"
import { LinkField } from "../forms/link-field"
import { BlockSwitch, BlockTitle } from "./block-kit"
import { useBlockKit } from "./use-block-kit"
import type { BlockFormProps } from "./use-block-kit"
import { BlockMenuSlot } from "./block-menu-slot"
import { BlockTextBody } from "./block-text-body"
import { FR } from "./footer-rows-fields"

/** A line under the fields: where the block's values come from (the store details, the shared lists). */
function Source({ text }: { text: string }) {
  return <p className="text-xs text-muted-foreground">{text}</p>
}

/**
 * A block's "İçerik" (adr/0070 §2, §7): its own words and what it shows.
 * The shop's details, profiles, ways to pay and trust badges are edited
 * where they live; a block chooses which of them show and says where
 * they come from.
 */
export function BlockContent({
  menus,
  ...props
}: BlockFormProps & { menus: readonly string[] | null }) {
  const kit = useBlockKit(props)
  const { t } = kit
  const { block, problems, onChange } = props
  // Each type's own form takes its block narrowed; the change comes back as a block of the footer
  const own = <B extends FooterBlock>(narrowed: B): BlockFormProps<B> => ({
    block: narrowed,
    problems,
    onChange,
  })
  switch (block.type) {
    case "text":
      return (
        <>
          <BlockTitle {...own(block)} max={L.title} hint={t(`${FR}.fields.title.hint`)} />
          <BlockTextBody {...own(block)} />
        </>
      )
    case "menu":
      return (
        <>
          <BlockMenuSlot {...own(block)} menus={menus} />
          <BlockTitle
            {...own(block)}
            max={L.title}
            placeholder={menus?.[block.slot - 1]}
            hint={t(`${FR}.fields.title.menuHint`)}
          />
        </>
      )
    case "brand":
      return (
        <>
          <BlockSwitch {...own(block)} field="logo" hint={t(`${FR}.fields.logo.hint`)} />
          <TextField
            id={kit.id("about")}
            {...kit.names("about")}
            value={block.about}
            max={L.about}
            multiline
            error={kit.error("about", L.about)}
            onChange={(about) => {
              onChange({ ...block, about }, "about")
            }}
          />
          <BlockSwitch {...own(block)} field="social" hint={t(`${FR}.fields.social.hint`)} />
        </>
      )
    case "newsletter":
      return (
        <>
          <BlockTitle {...own(block)} max={L.newsletterTitle} />
          <TextField
            id={kit.id("description")}
            {...kit.names("description")}
            value={block.description}
            max={NEWSLETTER_LIMITS.description}
            tokens
            error={kit.error("description", NEWSLETTER_LIMITS.description)}
            onChange={(description) => {
              onChange({ ...block, description }, "description")
            }}
          />
          <TextField
            id={kit.id("text")}
            {...kit.names("text")}
            value={block.text}
            max={L.newsletterText}
            tokens
            multiline
            hint={t(`${FR}.fields.text.hint`)}
            error={kit.error("text", L.newsletterText)}
            onChange={(text) => {
              onChange({ ...block, text }, "text")
            }}
          />
        </>
      )
    case "contact":
      return (
        <>
          <BlockTitle {...own(block)} max={L.title} />
          {(["address", "phone", "whatsapp", "email", "hours"] as const).map((field) => (
            <BlockSwitch key={field} {...own(block)} field={field} />
          ))}
          <Source text={t(`${FR}.source.contact`)} />
        </>
      )
    case "social":
      return (
        <>
          <BlockTitle {...own(block)} max={L.title} />
          <Source text={t(`${FR}.source.social`)} />
        </>
      )
    case "payments":
      return (
        <>
          <BlockTitle {...own(block)} max={L.title} />
          <BlockSwitch {...own(block)} field="carriers" />
          <Source text={t(`${FR}.source.payments`)} />
        </>
      )
    case "image":
      return (
        <>
          <ImageField
            id={kit.id("image")}
            label={kit.names("image").label}
            image={block.image}
            removable={false}
            altError={kit.error("image", L.alt)}
            onChange={(image) => {
              onChange({ ...block, image })
            }}
          />
          <LinkField
            id={kit.id("link")}
            {...kit.names("link")}
            link={block.link}
            error={kit.error("link")}
            onChange={(link, field) => {
              onChange({ ...block, link }, field ? "link" : undefined)
            }}
          />
        </>
      )
    case "app_badges":
      return (
        <>
          {(["app_store", "google_play"] as const).map((field) => (
            <TextField
              key={field}
              id={kit.id(field)}
              {...kit.names(field)}
              value={block[field]}
              max={512}
              placeholder={t(`${FR}.fields.${field}.placeholder`)}
              hint={t(`${FR}.fields.${field}.hint`)}
              error={kit.error(field)}
              onChange={(value) => {
                onChange({ ...block, [field]: value?.trim() ?? null }, field)
              }}
            />
          ))}
        </>
      )
    case "trust":
      return (
        <>
          <CountField
            id={kit.id("limit")}
            {...kit.names("limit")}
            value={block.limit}
            min={FOOTER_TRUST_LIMIT.min}
            max={FOOTER_TRUST_LIMIT.max}
            onChange={(limit) => {
              onChange({ ...block, limit })
            }}
          />
          <Source text={t(`${FR}.source.trust`)} />
        </>
      )
  }
}
