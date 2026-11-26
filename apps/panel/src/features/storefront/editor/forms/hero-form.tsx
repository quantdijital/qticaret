import { useTranslation } from "react-i18next"
import { RowActions } from "@/features/settings/components/storefront-rows"
import type { HeroSection, LayoutLink } from "@/features/storefront/api/layout"
import { LAYOUT_LIMITS as L } from "@/features/storefront/api/layout"
import { heroFullSettingsOf } from "@qticaret/types"
import { NamedGroup } from "../named-group"
import { F, TextField } from "./fields"
import { HeroCatalogFields } from "./hero-catalog-fields"
import { HandNoteField } from "./hand-note-field"
import { HeroAccentField, HeroAfterField, HeroFullAction } from "./hero-full-fields"
import { HeroSlidesField } from "./hero-slides-field"
import { HeroVideoFields } from "./hero-video-fields"
import { useProblemText } from "./problem-text"
import type { SectionFormProps } from "./form-props"
import { ImageField } from "./image-field"
import { PREVIEW_IDS } from "./preview-fields"
import { AddLinkButton, LinkCard } from "./link-field"
import { useLinkPicker } from "./use-link-picker"

const H = "storefront.editor.hero"

type HeroFields = Pick<HeroSection, "eyebrow" | "heading" | "text" | "links" | "image">

/**
 * The opening of the home page in its groups (docs/18 §7.1): "İçerik" the
 * short line, the heading, a sentence and the image, "Düğmeler" its
 * buttons. The catalogue opening's words, buttons and pictures are its
 * slides' (adr/0049 Ek 2026-11-15): "İçerik" the line and the slides, its
 * own parts in their groups after (`HeroCatalogFields`). The full image
 * (adr/0077 §9) adds its accent line under the heading and, after the
 * picture, what stands under the words; its buttons only while it shows them,
 * and its video button's link and words in "Video".
 */
export function HeroForm({ section, problems, onChange }: SectionFormProps<HeroSection>) {
  const { t } = useTranslation()
  const problem = useProblemText()
  const catalog = section.variant === "category_list" ? section : null
  const full = section.variant === "full_image" ? section : null
  const searching = full !== null && heroFullSettingsOf(full).action === "search"
  const set = (next: Partial<HeroFields>, field?: string) => {
    onChange({ ...section, ...next }, field)
  }
  const eyebrow = (
    <TextField
      id={PREVIEW_IDS.text(section.id, "eyebrow")}
      label={t(`${F}.eyebrow`)}
      value={section.eyebrow}
      max={L.eyebrow}
      tokens
      placeholder={t(`${H}.eyebrowPlaceholder`)}
      error={problem(problems["eyebrow"], L.eyebrow)}
      onChange={(eyebrow) => {
        set({ eyebrow }, "eyebrow")
      }}
    />
  )
  if (catalog) {
    return (
      <>
        <NamedGroup name="content">
          {eyebrow}
          <HeroSlidesField section={catalog} problems={problems} onChange={onChange} />
        </NamedGroup>
        <HeroCatalogFields section={catalog} problems={problems} onChange={onChange} />
      </>
    )
  }
  return (
    <>
      <NamedGroup name="content">
        {eyebrow}
        {/* The full image's hand note stands over its heading, as the storefront draws it */}
        {full ? (
          <HandNoteField
            sectionId={section.id}
            keys="storefront.editor.heroFull"
            value={full.note ?? null}
            problem={problems["note"]}
            onChange={(note) => {
              onChange({ ...full, note }, "note")
            }}
          />
        ) : null}
        <TextField
          id={PREVIEW_IDS.text(section.id, "heading")}
          label={t(`${F}.heading`)}
          value={section.heading}
          max={L.heading}
          tokens
          placeholder={t("storefront.editor.defaults.heading")}
          hint={t(`${H}.headingHint`)}
          error={problem(problems["heading"], L.heading)}
          onChange={(heading) => {
            set({ heading }, "heading")
          }}
        />
        {full ? <HeroAccentField section={full} problems={problems} onChange={onChange} /> : null}
        {full ? <HeroAfterField section={full} problems={problems} onChange={onChange} /> : null}
        <TextField
          id={PREVIEW_IDS.text(section.id, "text")}
          label={t(`${F}.text`)}
          value={section.text}
          max={L.text}
          tokens
          multiline
          placeholder={t(`${H}.textPlaceholder`)}
          error={problem(problems["text"], L.text)}
          onChange={(text) => {
            set({ text }, "text")
          }}
        />
        <ImageField
          id={PREVIEW_IDS.text(section.id, "image")}
          label={t(`${F}.image`)}
          hint={t(`${H}.imageHint`)}
          image={section.image}
          altError={problem(problems["image"], L.alt)}
          onChange={(image) => {
            set({ image }, image && section.image ? "image" : undefined)
          }}
        />
        {full ? <HeroFullAction section={full} onChange={onChange} /> : null}
      </NamedGroup>
      {searching ? null : (
        <NamedGroup name="buttons" hint={t(`${H}.buttonsHint`, { max: L.heroLinks })}>
          <HeroButtons section={section} problems={problems} onChange={set} />
        </NamedGroup>
      )}
      {full ? <HeroVideoFields section={full} problems={problems} onChange={onChange} /> : null}
    </>
  )
}

/** The opening's buttons: each a link card moved and taken off in place, up to its limit. */
function HeroButtons({
  section,
  problems,
  onChange,
}: {
  section: HeroSection
  problems: SectionFormProps<HeroSection>["problems"]
  onChange: (next: Partial<HeroFields>, field?: string) => void
}) {
  const { t } = useTranslation()
  const problem = useProblemText()
  const setLinks = (links: LayoutLink[]) => {
    onChange({ links })
  }
  // A new button, or another target for the one being changed
  const picker = useLinkPicker((link, was) => {
    setLinks(
      was ? section.links.map((each) => (each === was ? link : each)) : [...section.links, link]
    )
  })
  return (
    <>
      {section.links.map((link, index) => {
        const item = t(`${H}.button`, { number: index + 1 })
        return (
          <LinkCard
            key={`${String(index)}-${link.kind}`}
            id={PREVIEW_IDS.text(section.id, `links.${String(index)}`)}
            link={link}
            error={problem(problems[`links.${String(index)}`], L.label)}
            onChange={(next, field) => {
              onChange(
                { links: section.links.map((each, at) => (at === index ? next : each)) },
                field && `links.${String(index)}.label`
              )
            }}
            onEdit={() => {
              picker.open(link)
            }}
            actions={
              <RowActions
                index={index}
                count={section.links.length}
                item={item}
                onMove={(to) => {
                  const next = section.links.filter((_, at) => at !== index)
                  next.splice(to, 0, link)
                  setLinks(next)
                }}
                onRemove={() => {
                  setLinks(section.links.filter((_, at) => at !== index))
                }}
              />
            }
          />
        )
      })}
      <AddLinkButton
        label={t(`${H}.addButton`)}
        disabled={section.links.length >= L.heroLinks}
        onClick={() => {
          picker.open(null)
        }}
      />
      {picker.dialog}
    </>
  )
}
