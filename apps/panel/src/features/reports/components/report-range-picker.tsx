import { getRouteApi, useNavigate } from "@tanstack/react-router"
import { CalendarRange } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { PeriodPicker } from "@qticaret/admin-ui/patterns/period-picker"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Input } from "@qticaret/admin-ui/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@qticaret/admin-ui/ui/popover"
import { DEFAULT_PERIOD, PERIODS } from "@/features/dashboard/period"
import { turkishDay } from "@/features/reports/range"
import { formatDate } from "@qticaret/admin-ui/lib/format"

const route = getRouteApi("/_auth/reports")
const P = "period.custom"

/**
 * The days a report reads (F11.1): the dashboard's presets, or a range
 * of Turkish days up to a year and a day; the address keeps the choice.
 */
export function ReportRangePicker() {
  const { t } = useTranslation()
  const search = route.useSearch()
  const navigate = useNavigate()
  const custom = search.from && search.to ? { from: search.from, to: search.to } : null
  const today = turkishDay(new Date())
  const [open, setOpen] = useState(false)
  const [from, setFrom] = useState(custom?.from ?? today)
  const [to, setTo] = useState(custom?.to ?? today)
  const valid = from !== "" && to !== "" && from <= to && to <= today
  return (
    <div className="flex flex-wrap items-center gap-2">
      <PeriodPicker
        periods={PERIODS}
        labelOf={(key) => t(`period.${key}`)}
        // No preset lit while a range of days is shown
        value={custom ? null : (search.period ?? DEFAULT_PERIOD)}
        onChange={(next) => {
          void navigate({
            to: ".",
            search: { period: next === DEFAULT_PERIOD ? undefined : next },
            replace: true,
          })
        }}
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant={custom ? "secondary" : "outline"} className="shadow-card">
            <CalendarRange aria-hidden="true" />
            {custom
              ? t(`${P}.chosen`, { from: formatDate(custom.from), to: formatDate(custom.to) })
              : t(`${P}.label`)}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72">
          <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault()
              if (!valid) {
                return
              }
              setOpen(false)
              void navigate({ to: ".", search: { from, to }, replace: true })
            }}
          >
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              {t(`${P}.from`)}
              <Input
                type="date"
                value={from}
                max={today}
                onChange={(event) => {
                  setFrom(event.target.value)
                }}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              {t(`${P}.to`)}
              <Input
                type="date"
                value={to}
                min={from}
                max={today}
                onChange={(event) => {
                  setTo(event.target.value)
                }}
              />
            </label>
            <p className="text-xs text-muted-foreground">{t(`${P}.hint`)}</p>
            <Button type="submit" disabled={!valid}>
              {t(`${P}.apply`)}
            </Button>
          </form>
        </PopoverContent>
      </Popover>
    </div>
  )
}
