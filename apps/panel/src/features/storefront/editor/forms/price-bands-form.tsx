import { Plus } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@qticaret/admin-ui/ui/button"
import { RowActions } from "@/features/settings/components/storefront-rows"
import type { PriceBand, PriceBandsSection } from "@/features/storefront/api/layout"
import { PRICE_BANDS_LIMITS as B } from "@/features/storefront/api/layout"
import { SwitchRow } from "../theme-fields"
import { FIELD_IDS } from "./field-registry"
import { CountField, FieldGroup, TextField } from "./fields"
import type { SectionFormProps } from "./form-props"
import { PriceBandRange, isPriced, nextBound } from "./price-band-range"
import { useProblemText } from "./problem-text"
import { TitleField } from "./simple-forms"

const P = "storefront.editor.priceBands"

const LIRA = new Intl.NumberFormat("tr-TR")

/**
 * The price bands (adr/0049 Ek 2026-11-14, Katalog ana sayfası): a title,
 * two to four bands, each a label, a line, an optional category (adr/0049,
 * 2026-11-15) and an upper bound in whole lira; the price bands' bounds
 * rise band to band (the last may have none: "and up"), a category band's
 * is its own and optional; and the products shown small in each band,
 * picked by the storefront's server from the shop's own prices, on or off
 * and how many.
 */
export function PriceBandsForm({
  section,
  problems,
  onChange,
}: SectionFormProps<PriceBandsSection>) {
  const { t } = useTranslation()
  const problem = useProblemText()
  const set = (next: Partial<PriceBandsSection>, field?: string) => {
    onChange({ ...section, ...next }, field)
  }
  const setBand = (index: number, next: Partial<PriceBand>, field?: string) => {
    set(
      { bands: section.bands.map((band, at) => (at === index ? { ...band, ...next } : band)) },
      field && `bands.${String(index)}.${field}`
    )
  }
  /** The price band before's bound: where an open price band starts. */
  const before = (index: number) => section.bands.slice(0, index).findLast(isPriced)?.max ?? null
  /** "500 TL'ye kadar", "2.500 TL üzeri": the label a band's bound suggests; a category band's, a name. */
  const suggested = (band: PriceBand, index: number) =>
    band.max !== null
      ? t(`${P}.labelUnder`, { amount: LIRA.format(band.max) })
      : isPriced(band)
        ? t(`${P}.labelOpen`, { amount: LIRA.format(before(index) ?? 0) })
        : t(`${P}.labelCategory`)
  return (
    <div className="flex flex-col gap-5">
      {problems["limit"] ? (
        <p role="alert" className="text-sm text-destructive-text">
          {t(`storefront.editor.problems.${problems["limit"]}`, { max: B.perPage })}
        </p>
      ) : null}
      <TitleField
        id={section.id}
        title={section.title}
        placeholder={t("storefront.editor.defaults.price_bands")}
        problem={problems["title"]}
        onChange={(title) => {
          set({ title }, "title")
        }}
      />
      <FieldGroup title={t(`${P}.bands`)} hint={t(`${P}.bandsHint`)}>
        {problems["bands"] ? (
          <p role="alert" className="text-xs text-destructive-text">
            {problem(problems["bands"])}
          </p>
        ) : null}
        {section.bands.map((band, index) => {
          const at = `bands.${String(index)}`
          const name = t(`${P}.band`, { number: index + 1 })
          return (
            <div key={String(index)} className="flex flex-col gap-3 rounded-md border p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{name}</span>
                <RowActions
                  index={index}
                  count={section.bands.length}
                  item={name}
                  onMove={(to) => {
                    const next = section.bands.filter((_, each) => each !== index)
                    next.splice(to, 0, band)
                    set({ bands: next })
                  }}
                  removable={section.bands.length > B.bands.min}
                  onRemove={() => {
                    set({ bands: section.bands.filter((_, each) => each !== index) })
                  }}
                />
              </div>
              <TextField
                id={`${section.id}-${at}-label`}
                label={t(`${P}.label`)}
                value={band.label}
                max={B.label}
                tokens
                required
                placeholder={suggested(band, index)}
                error={problem(problems[`${at}.label`], B.label)}
                onChange={(label) => {
                  setBand(index, { label: label ?? "" }, "label")
                }}
              />
              <TextField
                id={`${section.id}-${at}-text`}
                label={t(`${P}.text`)}
                value={band.text}
                max={B.text}
                tokens
                placeholder={t(`${P}.textPlaceholder`)}
                error={problem(problems[`${at}.text`], B.text)}
                onChange={(text) => {
                  setBand(index, { text }, "text")
                }}
              />
              <PriceBandRange
                id={`${section.id}-${at}`}
                band={band}
                bands={section.bands}
                index={index}
                onChange={(next, field) => {
                  setBand(index, next, field)
                }}
              />
            </div>
          )
        })}
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="self-start"
          disabled={section.bands.length >= B.bands.max}
          onClick={() => {
            // A new price band goes before an open one, so only the last price band stays open
            const open = section.bands.findIndex((band) => isPriced(band) && band.max === null)
            const at = open === -1 ? section.bands.length : open
            const added: PriceBand = {
              label: "",
              text: null,
              max: nextBound(section.bands.slice(0, at)),
              category_id: null,
            }
            set({ bands: section.bands.toSpliced(at, 0, added) })
          }}
        >
          <Plus />
          {t(`${P}.addBand`)}
        </Button>
      </FieldGroup>
      <div id={FIELD_IDS.content(section.id, "thumbs")}>
        <SwitchRow
          id={`${section.id}-thumbs`}
          label={t(`${P}.thumbs`)}
          term={t(`${P}.thumbsTerm`)}
          hint={t(`${P}.thumbsHint`)}
          checked={section.thumbs > 0}
          onChange={(checked) => {
            set({ thumbs: checked ? B.thumbs.default : 0 })
          }}
        />
      </div>
      {section.thumbs > 0 ? (
        <div id={FIELD_IDS.content(section.id, "thumbs_count")}>
          <CountField
            id={`${section.id}-thumbs-count`}
            label={t(`${P}.thumbsCount`)}
            term={t(`${P}.thumbsCountTerm`)}
            value={section.thumbs}
            max={B.thumbs.max}
            onChange={(thumbs) => {
              set({ thumbs }, "thumbs")
            }}
          />
        </div>
      ) : null}
    </div>
  )
}
