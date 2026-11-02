import { Plus } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Field } from "@/components/patterns/form-section"
import { Button } from "@/components/ui/button"
import { EmptyLine, RowActions } from "@/features/settings/components/storefront-rows"
import { LAYOUT_LIMITS } from "@/features/storefront/api/layout"
import type { RecordKind } from "@/features/storefront/api/menus"
import { RecordPickerDialog } from "./record-picker-dialog"
import { useRecordNames } from "./record-names"

const R = "storefront.editor.records"

interface RecordListFieldProps {
  kind: RecordKind
  label: string
  ids: readonly string[]
  onChange: (ids: string[]) => void
  /** What the storefront shows with none chosen (or why one is needed). */
  empty: string
  error?: string | undefined
  /** How many the section takes; most take 24. */
  max?: number
}

/** Records the shop picks and orders: categories, brands, products. */
export function RecordListField({
  kind,
  label,
  ids,
  onChange,
  empty,
  error,
  max = LAYOUT_LIMITS.items,
}: RecordListFieldProps) {
  const { t } = useTranslation()
  const [picking, setPicking] = useState(false)
  const names = useRecordNames(kind, ids)
  const full = ids.length >= max
  const nameOf = (id: string) =>
    names.data?.[id] ?? (names.isPending ? t("common.loading") : t(`${R}.missing`))
  return (
    <Field label={label} error={error}>
      {ids.length === 0 ? (
        <EmptyLine text={empty} />
      ) : (
        <ol aria-label={label} className="flex flex-col divide-y rounded-md border">
          {ids.map((id, index) => (
            <li key={id} className="flex items-center gap-2 py-1 pr-1 pl-3">
              <span className="min-w-0 flex-1 truncate text-sm">{nameOf(id)}</span>
              <RowActions
                index={index}
                count={ids.length}
                item={nameOf(id)}
                onMove={(to) => {
                  const next = ids.filter((each) => each !== id)
                  next.splice(to, 0, id)
                  onChange(next)
                }}
                onRemove={() => {
                  onChange(ids.filter((each) => each !== id))
                }}
              />
            </li>
          ))}
        </ol>
      )}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            setPicking(true)
          }}
        >
          <Plus />
          {t(`${R}.add.${kind}`)}
        </Button>
        <span className="text-xs text-muted-foreground">{t(`${R}.limit`, { max })}</span>
      </div>
      {picking ? (
        <RecordPickerDialog
          kind={kind}
          chosen={ids}
          multiple
          full={full}
          onToggle={(option) => {
            onChange(
              ids.includes(option.id)
                ? ids.filter((each) => each !== option.id)
                : [...ids, option.id]
            )
          }}
          onClose={() => {
            setPicking(false)
          }}
        />
      ) : null}
    </Field>
  )
}

interface RecordFieldProps {
  kind: RecordKind
  label: string
  /** Empty: none chosen yet. */
  id: string
  onChange: (id: string) => void
  error?: string | undefined
}

/** One record the section draws from: a category or a collection. */
export function RecordField({ kind, label, id, onChange, error }: RecordFieldProps) {
  const { t } = useTranslation()
  const [picking, setPicking] = useState(false)
  const names = useRecordNames(kind, id ? [id] : [])
  const name = id
    ? (names.data?.[id] ?? (names.isPending ? t("common.loading") : t(`${R}.missing`)))
    : null
  return (
    <Field label={label} error={error} required>
      <div className="flex items-center gap-2">
        <span
          className={
            name
              ? "min-w-0 flex-1 truncate text-sm"
              : "min-w-0 flex-1 truncate text-sm text-muted-foreground"
          }
        >
          {name ?? t(`${R}.none`)}
        </span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          aria-label={t(name ? `${R}.changeOf` : `${R}.chooseOf`, { label })}
          onClick={() => {
            setPicking(true)
          }}
        >
          {t(name ? `${R}.change` : `${R}.choose`)}
        </Button>
      </div>
      {picking ? (
        <RecordPickerDialog
          kind={kind}
          chosen={id ? [id] : []}
          multiple={false}
          onToggle={(option) => {
            onChange(option.id)
          }}
          onClose={() => {
            setPicking(false)
          }}
        />
      ) : null}
    </Field>
  )
}
