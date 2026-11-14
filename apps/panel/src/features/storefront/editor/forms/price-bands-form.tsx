import { Plus } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { NumberField } from "@qticaret/admin-ui/patterns/number-field"
import { Button } from "@qticaret/admin-ui/ui/button"
import { RowActions } from "@/features/settings/components/storefront-rows"
import type { PriceBand, PriceBandsSection } from "@/features/storefront/api/layout"
import { PRICE_BANDS_LIMITS as B } from "@/features/storefront/api/layout"
import { SwitchRow } from "../theme-fields"
import { CountField, FieldGroup, TextField } from "./fields"
import type { SectionFormProps } from "./form-props"
import { useProblemText } from "./problem-text"
import { TitleField } from "./simple-forms"

const P = "storefront.editor.priceBands"

const LIRA = new Intl.NumberFormat("tr-TR")

/** A new band after the last: its bound past the band before's, open when the last one was. */
function nextBand(bands: readonly PriceBand[]): PriceBand {
  const bounds = bands.flatMap((band) => (band.max === null ? [] : [band.max]))
  const top = bounds.length > 0 ? Math.max(...bounds) : 0
  return { label: "", text: null, max: Math.min(B.max, top > 0 ? top * 2 : 500) }
}

/**
 * The price bands (adr/0049 Ek 2026-11-14, Katalog ana sayfası): a title,
 * two to four bands, each a label, a line and an upper bound in whole lira
 * (the last may have none: "and up"), rising band to band; and the
 * products shown small in each band, picked by the storefront's server
 * from the shop's own prices, on or off and how many.
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
  const last = section.bands.length - 1
  const before = (index: number) => section.bands[index - 1]?.max ?? null
  /** "500 TL'ye kadar", "2.500 TL üzeri": the label a band's bound suggests. */
  const suggested = (band: PriceBand, index: number) =>
    band.max === null
      ? t(`${P}.labelOpen`, { amount: LIRA.format(before(index) ?? 0) })
      : t(`${P}.labelUnder`, { amount: LIRA.format(band.max) })
  return (
    <div className="flex flex-col gap-5">
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
              {band.max === null ? null : (
                <Field
                  label={t(`${P}.max`)}
                  htmlFor={`${section.id}-${at}-max`}
                  hint={t(`${P}.maxHint`)}
                >
                  <NumberField
                    plain
                    id={`${section.id}-${at}-max`}
                    min={1}
                    max={B.max}
                    step={1}
                    value={band.max}
                    className="w-40"
                    onChange={(event) => {
                      const next = Math.trunc(Number(event.target.value))
                      if (Number.isFinite(next) && event.target.value !== "") {
                        setBand(index, { max: Math.max(1, Math.min(B.max, next)) }, "max")
                      }
                    }}
                  />
                </Field>
              )}
              {index === last ? (
                <SwitchRow
                  id={`${section.id}-${at}-open`}
                  label={t(`${P}.open`)}
                  hint={t(`${P}.openHint`)}
                  checked={band.max === null}
                  onChange={(open) => {
                    setBand(index, {
                      max: open ? null : nextBand(section.bands.slice(0, index)).max,
                    })
                  }}
                />
              ) : null}
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
            // A new band goes before an open last one, so only the last stays open
            const open = section.bands.at(-1)?.max === null
            const closed = open ? section.bands.slice(0, -1) : section.bands
            const added = nextBand(closed)
            set({
              bands: open ? [...closed, added, ...section.bands.slice(-1)] : [...closed, added],
            })
          }}
        >
          <Plus />
          {t(`${P}.addBand`)}
        </Button>
      </FieldGroup>
      <SwitchRow
        id={`${section.id}-thumbs`}
        label={t(`${P}.thumbs`)}
        hint={t(`${P}.thumbsHint`)}
        checked={section.thumbs > 0}
        onChange={(checked) => {
          set({ thumbs: checked ? B.thumbs.default : 0 })
        }}
      />
      {section.thumbs > 0 ? (
        <CountField
          id={`${section.id}-thumbs-count`}
          label={t(`${P}.thumbsCount`)}
          value={section.thumbs}
          max={B.thumbs.max}
          onChange={(thumbs) => {
            set({ thumbs }, "thumbs")
          }}
        />
      ) : null}
    </div>
  )
}
