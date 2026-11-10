import { CalendarRange } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { ADMIN_UI_NS } from "../i18n"
import { Button } from "../ui/button"
import { Input } from "../ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover"
import { dayOf } from "../lib/days"
import { formatDate } from "../lib/format"

export interface DayRange {
  from?: string | undefined
  to?: string | undefined
}

/**
 * A list's days as a filter (the audit log, the order list): Turkish days,
 * `YYYY-MM-DD`, either end may stay open; a button that opens two date
 * fields, the same size as the selects beside it.
 */
export function DayRangeFilter({
  value,
  onChange,
  hint,
}: {
  value: DayRange
  onChange: (next: DayRange) => void
  /** What the days are of, under the fields. */
  hint?: string
}) {
  const { t } = useTranslation(ADMIN_UI_NS)
  const today = dayOf(new Date())
  const [open, setOpen] = useState(false)
  const [from, setFrom] = useState(value.from ?? "")
  const [to, setTo] = useState(value.to ?? "")
  const chosen = value.from ?? value.to
  const valid = (from === "" || to === "" || from <= to) && (from !== "" || to !== "")
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) {
          setFrom(value.from ?? "")
          setTo(value.to ?? "")
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant={chosen ? "secondary" : "outline"}
          className="w-full justify-start font-normal sm:w-56"
        >
          <CalendarRange aria-hidden="true" />
          {chosen
            ? t("list.days.range", {
                from: value.from ? formatDate(value.from) : "…",
                to: value.to ? formatDate(value.to) : "…",
              })
            : t("list.days.anyTime")}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault()
            if (valid) {
              setOpen(false)
              onChange({ from: from || undefined, to: to || undefined })
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
          <p className="text-xs text-muted-foreground">{hint ?? t("list.days.hint")}</p>
          <span className="flex gap-2">
            {chosen ? (
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setOpen(false)
                  onChange({ from: undefined, to: undefined })
                }}
              >
                {t("list.days.clear")}
              </Button>
            ) : null}
            <Button type="submit" className="flex-1" disabled={!valid}>
              {t("period.custom.apply")}
            </Button>
          </span>
        </form>
      </PopoverContent>
    </Popover>
  )
}
