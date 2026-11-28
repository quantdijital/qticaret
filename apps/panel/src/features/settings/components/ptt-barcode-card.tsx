import { zodResolver } from "@hookform/resolvers/zod"
import { useQuery } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { beginSave } from "@qticaret/admin-ui/lib/forms"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { ErrorState, LoadingRows } from "@qticaret/admin-ui/patterns/states"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Input } from "@qticaret/admin-ui/ui/input"
import {
  pttRangesQuery,
  useAddPttRange,
  useRemovePttRange,
} from "@/features/settings/api/ptt-barcodes"
import type { PttRange, PttRanges } from "@/features/settings/api/ptt-barcodes"
import { pttRangeSchema } from "@/features/settings/ptt"
import type { PttRangeValues } from "@/features/settings/ptt"
import { errorText } from "@/lib/errors"

const R = "settings.shipping.ptt.ranges"
const EMPTY: PttRangeValues = { first: "", last: "" }

const count = (value: number) => new Intl.NumberFormat("tr-TR").format(value)

/** What is left, said once above the list: plenty, running low, or used up. */
function Summary({ data }: { data: PttRanges }) {
  const { t } = useTranslation()
  if (data.ranges.length === 0) {
    return (
      <p className="text-[13px] text-warning-text" data-testid="ptt-ranges-summary">
        {t(`${R}.empty`)}
      </p>
    )
  }
  if (data.remaining === 0) {
    return (
      <p className="text-[13px] text-destructive-text" data-testid="ptt-ranges-summary">
        {t(`${R}.exhausted`)}
      </p>
    )
  }
  return (
    <p
      className={data.low ? "text-[13px] text-warning-text" : "text-[13px] text-muted-foreground"}
      data-testid="ptt-ranges-summary"
    >
      {t(data.low ? `${R}.low` : `${R}.remaining`, { left: count(data.remaining) })}
    </p>
  )
}

function RangeRow({ range }: { range: PttRange }) {
  const { t } = useTranslation()
  const remove = useRemovePttRange()
  const label = t(`${R}.range`, { first: range.first, last: range.last })
  return (
    <li className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5">
      <div className="flex min-w-0 flex-col">
        <span className="font-mono text-sm tabular-nums">{label}</span>
        <span className="text-[13px] text-muted-foreground">
          {t(`${R}.usage`, {
            used: count(range.used),
            size: count(range.size),
            remaining: count(range.remaining),
          })}
        </span>
      </div>
      {/* A range in use stays: its numbers must never be handed out again */}
      {range.used === 0 ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={t(`${R}.removeLabel`, { range: label })}
          disabled={remove.isPending}
          onClick={() => {
            remove.mutate(range.id, {
              onSuccess: () => toast.success(t(`${R}.removed`)),
              onError: (failure) => toast.error(errorText(t, failure)),
            })
          }}
        >
          {t(`${R}.remove`)}
        </Button>
      ) : null}
    </li>
  )
}

function AddRange() {
  const { t } = useTranslation()
  const add = useAddPttRange()
  const form = useForm<PttRangeValues>({
    resolver: zodResolver(pttRangeSchema),
    defaultValues: EMPTY,
  })
  const { errors } = form.formState
  const submit = form.handleSubmit((values) => {
    const done = beginSave(form)
    add.mutate(
      { first: values.first.trim(), last: values.last.trim() },
      {
        onSuccess: () => {
          done(EMPTY)
          toast.success(t(`${R}.added`))
        },
        onError: (failure) => toast.error(errorText(t, failure)),
      }
    )
  })
  const message = (key: string | undefined) => (key ? t(key) : undefined)
  return (
    <form
      noValidate
      className="grid min-w-0 gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-start"
      onSubmit={(event) => {
        event.preventDefault()
        void submit()
      }}
    >
      <Field
        label={t(`${R}.first`)}
        htmlFor="ptt-range-first"
        hint={t(`${R}.hint`)}
        error={message(errors.first?.message)}
      >
        <Input
          id="ptt-range-first"
          autoComplete="off"
          inputMode="numeric"
          maxLength={12}
          placeholder={t(`${R}.firstPlaceholder`)}
          {...form.register("first")}
        />
      </Field>
      <Field label={t(`${R}.last`)} htmlFor="ptt-range-last" error={message(errors.last?.message)}>
        <Input
          id="ptt-range-last"
          autoComplete="off"
          inputMode="numeric"
          maxLength={12}
          placeholder={t(`${R}.lastPlaceholder`)}
          {...form.register("last")}
        />
      </Field>
      {/* Level with the inputs, under their labels */}
      <Button type="submit" className="sm:mt-[26px]" disabled={add.isPending}>
        {t(`${R}.add`)}
      </Button>
    </form>
  )
}

/**
 * The barcode ranges PTT gave the shop (docs/entegrasyonlar/ptt.md): each
 * parcel takes the next number, which is never handed out again. What is
 * left is said on top, with a warning when it runs low (under 10 % or
 * 50) and when it is used up ("Kargoya ver" then stops). A range entered
 * by mistake, none of it used, can be removed; a new one is added below.
 */
export function PttBarcodeCard() {
  const { t } = useTranslation()
  const query = useQuery(pttRangesQuery())
  return (
    <SectionCard title={t(`${R}.title`)} description={t(`${R}.description`)}>
      {query.isError ? (
        <ErrorState text={errorText(t, query.error)} onRetry={() => void query.refetch()} />
      ) : !query.data ? (
        <LoadingRows rows={2} />
      ) : (
        <div className="flex min-w-0 flex-col gap-4">
          <Summary data={query.data} />
          {query.data.ranges.length > 0 ? (
            <ul className="divide-y border-y" aria-label={t(`${R}.title`)}>
              {query.data.ranges.map((range) => (
                <RangeRow key={range.id} range={range} />
              ))}
            </ul>
          ) : null}
          <AddRange />
        </div>
      )}
    </SectionCard>
  )
}
