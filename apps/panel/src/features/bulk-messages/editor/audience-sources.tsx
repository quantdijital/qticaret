import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import type { ReactNode } from "react"
import { Controller } from "react-hook-form"
import type { UseFormReturn } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { ErrorState, LoadingRows } from "@qticaret/admin-ui/patterns/states"
import { Checkbox } from "@qticaret/admin-ui/ui/checkbox"
import type { AudienceSource } from "@/features/bulk-messages/api/types"
import { LIMITS, hasSource, toggleSource } from "@/features/bulk-messages/form"
import type { EditorValues } from "@/features/bulk-messages/form"
import { customerGroupsQuery, customerSegmentsQuery } from "@/features/customers/api/groups"
import { errorText } from "@/lib/errors"
import { formatCount } from "@qticaret/admin-ui/lib/format"

const A = "bulkMessages.audience"

interface Option {
  source: AudienceSource
  label: string
  hint: string
}

function SourceRow({
  option,
  checked,
  disabled,
  onChange,
}: {
  option: Option
  checked: boolean
  disabled: boolean
  onChange: (on: boolean) => void
}) {
  const id = `bulk-source-${option.source.kind}-${"id" in option.source ? option.source.id : "all"}`
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2.5 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-accent"
    >
      <Checkbox
        id={id}
        checked={checked}
        disabled={disabled && !checked}
        className="mt-0.5"
        onCheckedChange={(next) => {
          onChange(next === true)
        }}
      />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm font-medium">{option.label}</span>
        <span className="text-xs text-muted-foreground">{option.hint}</span>
      </span>
    </label>
  )
}

/** A column of the shop's own lists: its segments, or its hand-kept groups. */
function ListColumn({
  title,
  options,
  empty,
  render,
}: {
  title: string
  options: Option[]
  empty: string
  render: (option: Option) => ReactNode
}) {
  const { t } = useTranslation()
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <h3 className="text-[13px] font-medium text-muted-foreground">{title}</h3>
      {options.length === 0 ? (
        <p className="flex flex-1 flex-col items-start gap-2 rounded-md border border-dashed px-3 py-3 text-[13px] text-muted-foreground">
          {empty}
          <Link to="/customers/groups" className="font-medium text-primary-text hover:underline">
            {t(`${A}.manage`)}
          </Link>
        </p>
      ) : (
        <div className="flex flex-col gap-2">{options.map(render)}</div>
      )}
    </div>
  )
}

/**
 * Kitle (adr/0050 §3): every consented customer, the newsletter's
 * subscribers, the shop's segments and groups, several together. The
 * same person in two of them gets one message.
 */
export function AudienceSources({ form }: { form: UseFormReturn<EditorValues> }) {
  const { t } = useTranslation()
  const segments = useQuery(customerSegmentsQuery())
  const groups = useQuery(customerGroupsQuery())
  const members = (count: number) => t(`${A}.members`, { count, members: formatCount(count) })
  const general: Option[] = (["all_consented", "newsletter"] as const).map((kind) => ({
    source: { kind },
    label: t(`${A}.${kind}`),
    hint: t(`${A}.${kind}Hint`),
  }))
  const segmentOptions: Option[] = (segments.data ?? []).map((segment) => ({
    source: { kind: "segment", id: segment.id },
    label: segment.name,
    hint: members(segment.member_count),
  }))
  // A segment's own group is offered as the segment
  const groupOptions: Option[] = (groups.data ?? [])
    .filter((group) => !group.segment)
    .map((group) => ({
      source: { kind: "group", id: group.id },
      label: group.name,
      hint: members(group.members),
    }))
  const failed = segments.error ?? groups.error
  return (
    <SectionCard title={t(`${A}.title`)} description={t(`${A}.description`)}>
      <Controller
        control={form.control}
        name="audience"
        render={({ field, fieldState }) => {
          const full = field.value.length >= LIMITS.sources
          const row = (option: Option) => (
            <SourceRow
              key={`${option.source.kind}-${"id" in option.source ? option.source.id : ""}`}
              option={option}
              checked={hasSource(field.value, option.source)}
              disabled={full}
              onChange={(on) => {
                field.onChange(toggleSource(field.value, option.source, on))
              }}
            />
          )
          return (
            <div className="flex flex-col gap-5">
              <div className="grid gap-2 sm:grid-cols-2">{general.map(row)}</div>
              {failed ? (
                <ErrorState
                  text={errorText(t, failed)}
                  onRetry={() => {
                    void segments.refetch()
                    void groups.refetch()
                  }}
                />
              ) : !segments.data || !groups.data ? (
                <LoadingRows rows={3} />
              ) : (
                <div className="grid items-stretch gap-5 md:grid-cols-2">
                  <ListColumn
                    title={t(`${A}.segments`)}
                    options={segmentOptions}
                    empty={t(`${A}.segmentsEmpty`)}
                    render={row}
                  />
                  <ListColumn
                    title={t(`${A}.groups`)}
                    options={groupOptions}
                    empty={t(`${A}.groupsEmpty`)}
                    render={row}
                  />
                </div>
              )}
              {fieldState.error?.message ? (
                <p role="alert" className="text-xs text-destructive-text">
                  {t(fieldState.error.message, { limit: LIMITS.sources })}
                </p>
              ) : full ? (
                <p className="text-xs text-muted-foreground">
                  {t(`${A}.full`, { limit: LIMITS.sources })}
                </p>
              ) : null}
            </div>
          )
        }}
      />
    </SectionCard>
  )
}
