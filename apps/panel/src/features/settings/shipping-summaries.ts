import type { TFunction } from "i18next"
import type { ShippingSettings } from "@/features/settings/api/sections"

const A = "settings.shipping.advanced"

const number = (value: number) =>
  new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 3 }).format(value)

const range = (min: number, max: number) =>
  min === max ? number(min) : `${number(min)}–${number(max)}`

/** Each folded card's one line: what it holds now, so it needs no opening to be checked. */
export function advancedSummaries(
  t: TFunction,
  saved: ShippingSettings,
  units: { weight: string; dimension: string }
) {
  const cutoff = saved.same_day_cutoff_hour
  const rows = saved.rate_table
  const parcel = saved.default_parcel
  return {
    delivery: [
      t(`${A}.handling`, { days: range(saved.handling_days_min, saved.handling_days_max) }),
      t(`${A}.transit`, { days: range(saved.transit_days_min, saved.transit_days_max) }),
      cutoff === null ? t(`${A}.noSameDay`) : t(`${A}.sameDay`, { hour: `${String(cutoff)}:00` }),
    ].join(" · "),
    rates:
      rows.length === 0
        ? t(`${A}.noRates`)
        : t(`${A}.rates`, { count: rows.length, desi: number(rows.at(-1)?.max_desi ?? 0) }),
    parcel: parcel
      ? `${number(parcel.weight)} ${units.weight} · ${number(parcel.length)} × ${number(parcel.width)} × ${number(parcel.height)} ${units.dimension}`
      : t(`${A}.platformParcel`),
    label:
      saved.label_format === "custom"
        ? `${String(saved.label_custom.width_mm)} × ${String(saved.label_custom.height_mm)} mm`
        : t(`settings.shipping.labels.formats.${saved.label_format}`),
  }
}
