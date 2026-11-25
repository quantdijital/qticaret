import { useState } from "react"
import { useTranslation } from "react-i18next"
import { ADMIN_UI_NS } from "../i18n"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { dayOf } from "../lib/days"
import type { DayRange } from "./day-range-filter"
import type { FilterValue, NumberFilter } from "./filter-bar-model"
import { NumberField } from "./number-field"

/** A number typed and applied (days waiting). */
export function NumberPane({
  filter,
  value,
  onApply,
}: {
  filter: NumberFilter
  value: number | undefined
  onApply: (next: FilterValue) => void
}) {
  const { t } = useTranslation(ADMIN_UI_NS)
  const [text, setText] = useState(value === undefined ? "" : String(value))
  const number = text === "" ? undefined : Number(text)
  const valid =
    number !== undefined &&
    Number.isFinite(number) &&
    (filter.min === undefined || number >= filter.min) &&
    (filter.max === undefined || number <= filter.max)
  return (
    <form
      className="flex items-center gap-2 px-1"
      onSubmit={(event) => {
        event.preventDefault()
        if (valid) {
          onApply(number)
        }
      }}
    >
      <NumberField
        className="flex-1"
        aria-label={filter.label}
        value={text}
        min={filter.min}
        max={filter.max}
        {...(filter.suffix ? { suffix: filter.suffix } : {})}
        onChange={(event) => {
          setText(event.target.value)
        }}
      />
      <Button type="submit" disabled={!valid}>
        {t("period.custom.apply")}
      </Button>
    </form>
  )
}

/** Days, either end open; the later end not before the earlier one. */
export function DaysPane({
  value,
  onApply,
}: {
  value: DayRange | undefined
  onApply: (next: FilterValue) => void
}) {
  const { t } = useTranslation(ADMIN_UI_NS)
  const today = dayOf(new Date())
  const [from, setFrom] = useState(value?.from ?? "")
  const [to, setTo] = useState(value?.to ?? "")
  const valid = (from === "" || to === "" || from <= to) && (from !== "" || to !== "")
  return (
    <form
      className="flex flex-col gap-3 px-1"
      onSubmit={(event) => {
        event.preventDefault()
        if (valid) {
          onApply({ from: from || undefined, to: to || undefined })
        }
      }}
    >
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        {t("period.custom.from")}
        <Input
          type="date"
          value={from}
          max={to || today}
          onChange={(event) => {
            setFrom(event.target.value)
          }}
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        {t("period.custom.to")}
        <Input
          type="date"
          value={to}
          min={from || undefined}
          max={today}
          onChange={(event) => {
            setTo(event.target.value)
          }}
        />
      </label>
      <Button type="submit" disabled={!valid}>
        {t("period.custom.apply")}
      </Button>
    </form>
  )
}
