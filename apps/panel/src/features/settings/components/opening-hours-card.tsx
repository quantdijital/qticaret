import { zodResolver } from "@hookform/resolvers/zod"
import { CopyCheck, Plus, X } from "lucide-react"
import { useForm, useWatch } from "react-hook-form"
import type { FieldErrors } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { z } from "zod"
import { CardForm } from "@qticaret/admin-ui/patterns/card-form"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Input } from "@qticaret/admin-ui/ui/input"
import { Switch } from "@qticaret/admin-ui/ui/switch"
import { useSaveSection } from "@/features/settings/api/sections"
import type { StoreSettings } from "@/features/settings/api/sections"
import {
  DEFAULT_RANGE,
  MAX_RANGES_PER_DAY,
  daysOf,
  hoursIssues,
  mondayToWeekdays,
  rangesOf,
  withBreak,
} from "@/features/settings/opening-hours"
import type { DayHours, TimeRange } from "@/features/settings/opening-hours"
import { errorText } from "@/lib/errors"
import { FULL_RESET } from "@qticaret/admin-ui/lib/forms"

const H = "settings.store.hours"

const schema = z
  .object({
    days: z.array(
      z.object({
        open: z.boolean(),
        ranges: z.array(z.object({ opens: z.string(), closes: z.string() })),
      })
    ),
  })
  .superRefine(({ days }, ctx) => {
    hoursIssues(days).forEach((issues, day) => {
      issues.forEach((issue, range) => {
        if (issue) {
          // An overlap is the later range's opening; the rest its closing
          const field = issue === "overlap" ? "opens" : "closes"
          ctx.addIssue({
            code: "custom",
            path: ["days", day, "ranges", range, field],
            message: `${H}.errors.${issue}`,
          })
        }
      })
    })
  })
type Values = z.infer<typeof schema>

const valuesOf = (saved: StoreSettings): Values => ({ days: daysOf(saved.opening_hours) })

type RangeErrors = NonNullable<FieldErrors<Values>["days"]>[number]

function DayRow({
  name,
  day,
  errors,
  onChange,
}: {
  name: string
  day: DayHours
  errors: RangeErrors | undefined
  onChange: (day: DayHours) => void
}) {
  const { t } = useTranslation()
  const setRange = (index: number, change: Partial<TimeRange>) => {
    onChange({
      ...day,
      ranges: day.ranges.map((range, at) => (at === index ? { ...range, ...change } : range)),
    })
  }
  const several = day.ranges.length > 1
  return (
    <li className="@container border-b py-3 first:pt-0 last:border-b-0 last:pb-0">
      {/* Day, ranges and the add button on one line when the card is wide enough; else the ranges under the day */}
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-2 @lg:grid-cols-[8rem_minmax(0,1fr)_auto]">
        <div className="col-start-1 row-start-1 flex h-9 items-center gap-3">
          <Switch
            checked={day.open}
            aria-label={t(`${H}.openOf`, { day: name })}
            onCheckedChange={(open) => {
              onChange({
                open,
                ranges: day.ranges.length > 0 ? day.ranges : [{ ...DEFAULT_RANGE }],
              })
            }}
          />
          <span className="text-sm font-medium">{name}</span>
        </div>
        {day.open ? (
          <ol className="col-span-2 flex flex-col gap-2 @lg:col-span-1 @lg:col-start-2 @lg:row-start-1">
            {day.ranges.map((range, index) => {
              const ofRange = several ? t(`${H}.rangeOf`, { day: name, number: index + 1 }) : name
              const failed = errors?.ranges?.[index]
              const message = failed?.opens?.message ?? failed?.closes?.message
              const errorId = `hours-${name}-${index}-error`
              return (
                // Ranges have no identity of their own; their place is it
                <li key={index} className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <Input
                      type="time"
                      value={range.opens}
                      aria-label={t(`${H}.opensOf`, { range: ofRange })}
                      aria-invalid={Boolean(failed?.opens)}
                      aria-describedby={message ? errorId : undefined}
                      className="w-32"
                      onChange={(event) => {
                        setRange(index, { opens: event.target.value })
                      }}
                    />
                    <span aria-hidden className="text-muted-foreground">
                      –
                    </span>
                    <Input
                      type="time"
                      value={range.closes}
                      aria-label={t(`${H}.closesOf`, { range: ofRange })}
                      aria-invalid={Boolean(failed?.closes)}
                      aria-describedby={message ? errorId : undefined}
                      className="w-32"
                      onChange={(event) => {
                        setRange(index, { closes: event.target.value })
                      }}
                    />
                    {several ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-destructive-text"
                        aria-label={t(`${H}.removeRange`, { range: ofRange })}
                        onClick={() => {
                          onChange({ ...day, ranges: day.ranges.filter((_, at) => at !== index) })
                        }}
                      >
                        <X />
                      </Button>
                    ) : null}
                  </div>
                  {message ? (
                    <p id={errorId} role="alert" className="text-xs text-destructive-text">
                      {t(message)}
                    </p>
                  ) : null}
                </li>
              )
            })}
          </ol>
        ) : (
          <span className="col-start-2 row-start-1 flex h-9 items-center text-sm text-muted-foreground">
            {t(`${H}.closed`)}
          </span>
        )}
        {day.open && day.ranges.length < MAX_RANGES_PER_DAY ? (
          <Button
            type="button"
            variant="ghost"
            className="col-start-2 row-start-1 @lg:col-start-3"
            aria-label={t(`${H}.addBreakOf`, { day: name })}
            onClick={() => {
              onChange({ ...day, ranges: withBreak(day.ranges) })
            }}
          >
            <Plus />
            {t(`${H}.addBreak`)}
          </Button>
        ) : null}
      </div>
    </li>
  )
}

/**
 * When the shop answers (adr/0048): seven days, each open or closed, with
 * up to three ranges (a lunch break); Monday's hours copy to the weekdays
 * in one go. Read by the contact page, the footer and Google's structured
 * data; checked here as the server checks it.
 */
export function OpeningHoursCard({
  saved,
  className,
}: {
  saved: StoreSettings
  className?: string
}) {
  const { t } = useTranslation()
  const save = useSaveSection<StoreSettings>("store")
  const values = valuesOf(saved)
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    values,
    resetOptions: { keepDirtyValues: true },
  })
  const days = useWatch({ control: form.control, name: "days" })
  const { errors, isSubmitted } = form.formState
  const update = (next: DayHours[]) => {
    form.setValue("days", next, { shouldDirty: true, shouldValidate: isSubmitted })
  }
  const submit = form.handleSubmit((next) => {
    save.mutate(
      { opening_hours: rangesOf(next.days) },
      {
        onSuccess: (result) => {
          form.reset(valuesOf(result.values), FULL_RESET)
          toast.success(t("settings.saved"))
        },
        onError: (failure) => toast.error(errorText(t, failure)),
      }
    )
  })
  const anyOpen = days.some((day) => day.open)
  return (
    <CardForm
      title={t(`${H}.title`)}
      description={t(`${H}.description`)}
      className={className}
      dirty={form.formState.isDirty}
      saving={save.isPending}
      onSubmit={() => void submit()}
      onReset={() => {
        form.reset(values, FULL_RESET)
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="text-[13px] text-muted-foreground">
          {t(anyOpen ? `${H}.midnightHint` : `${H}.empty`)}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            update(mondayToWeekdays(days))
          }}
        >
          <CopyCheck />
          {t(`${H}.copyWeekdays`)}
        </Button>
      </div>
      <ol className="flex flex-col">
        {days.map((day, index) => {
          const name = t(`${H}.days.${index + 1}`)
          return (
            <DayRow
              key={name}
              name={name}
              day={day}
              errors={errors.days?.[index]}
              onChange={(next) => {
                update(days.map((each, at) => (at === index ? next : each)))
              }}
            />
          )
        })}
      </ol>
    </CardForm>
  )
}
