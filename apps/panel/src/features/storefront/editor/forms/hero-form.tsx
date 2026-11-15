import { useTranslation } from "react-i18next"
import { RowActions } from "@/features/settings/components/storefront-rows"
import type { HeroSection, LayoutLink } from "@/features/storefront/api/layout"
import { LAYOUT_LIMITS as L } from "@/features/storefront/api/layout"
import { F, FieldGroup, TextField } from "./fields"
import { HeroCatalogFields } from "./hero-catalog-fields"
import { HeroSlidesField } from "./hero-slides-field"
import { useProblemText } from "./problem-text"
import type { SectionFormProps } from "./form-props"
import { ImageField } from "./image-field"
import { AddLinkButton, LinkCard } from "./link-field"
import { useLinkPicker } from "./use-link-picker"

const H = "storefront.editor.hero"

/** The opening of the home page: a short line, the heading, a sentence, buttons and an image. */
export function HeroForm({ section, problems, onChange }: SectionFormProps<HeroSection>) {
  const { t } = useTranslation()
  const problem = useProblemText()
  const catalog = section.variant === "category_list" ? section : null
  const set = (
    next: Partial<Pick<HeroSection, "eyebrow" | "heading" | "text" | "links" | "image">>,
    field?: string
  ) => {
    onChange({ ...section, ...next }, field)
  }
  const setLinks = (links: LayoutLink[]) => {
    set({ links })
  }
  // A new button, or another target for the one being changed
  const picker = useLinkPicker((link, was) => {
    setLinks(
      was ? section.links.map((each) => (each === was ? link : each)) : [...section.links, link]
    )
  })
  return (
    <div className="flex flex-col gap-5">
      <TextField
        id="hero-eyebrow"
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
      {/* H17's words, buttons and picture are its slides' (adr/0049 Ek 2026-11-15) */}
      {catalog ? (
        <HeroSlidesField section={catalog} problems={problems} onChange={onChange} />
      ) : (
        <>
          <TextField
            id="hero-heading"
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
          <TextField
            id="hero-text"
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
          <FieldGroup title={t(`${H}.buttons`)} hint={t(`${H}.buttonsHint`, { max: L.heroLinks })}>
            {section.links.map((link, index) => {
              const item = t(`${H}.button`, { number: index + 1 })
              return (
                <LinkCard
                  key={`${String(index)}-${link.kind}`}
                  id={`hero-link-${String(index)}`}
                  link={link}
                  error={problem(problems[`links.${String(index)}`], L.label)}
                  onChange={(next, field) => {
                    set(
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
          </FieldGroup>
          <ImageField
            id="hero-image"
            label={t(`${F}.image`)}
            hint={t(`${H}.imageHint`)}
            image={section.image}
            altError={problem(problems["image"], L.alt)}
            onChange={(image) => {
              set({ image }, image && section.image ? "image" : undefined)
            }}
          />
        </>
      )}
      {catalog ? (
        <HeroCatalogFields section={catalog} problems={problems} onChange={onChange} />
      ) : null}
      {picker.dialog}
    </div>
  )
}
