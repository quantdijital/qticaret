import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Field } from "@/components/patterns/form-section"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { saveCustomerSegment } from "@/features/customers/api/groups"
import type { CustomerSegment } from "@/features/customers/api/groups"
import { draftOf, rulesOf } from "@/features/customers/segment-form"
import type { DraftField, SegmentDraft, Tristate } from "@/features/customers/segment-form"
import { errorText } from "@/lib/errors"

const S = "customers.segments"

/** A three-way rule: either, yes or no. */
function TristateField({
  id,
  label,
  yes,
  no,
  value,
  onChange,
}: {
  id: string
  label: string
  yes: string
  no: string
  value: Tristate
  onChange: (value: Tristate) => void
}) {
  const { t } = useTranslation()
  return (
    <Field label={label} htmlFor={id}>
      <Select
        value={value}
        onValueChange={(next) => {
          onChange(next as Tristate)
        }}
      >
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="any">{t(`${S}.any`)}</SelectItem>
          <SelectItem value="yes">{yes}</SelectItem>
          <SelectItem value="no">{no}</SelectItem>
        </SelectContent>
      </Select>
    </Field>
  )
}

/**
 * A segment made or changed (F10.3): its name and its rules; empty
 * fields are no rule. Saving fills its group at once.
 */
export function SegmentDialog({
  segment,
  open,
  onClose,
}: {
  /** The segment changed; none for a new one. */
  segment: CustomerSegment | null
  open: boolean
  onClose: () => void
}) {
  const { t } = useTranslation()
  const client = useQueryClient()
  const [draft, setDraft] = useState<SegmentDraft>(() => draftOf(segment ?? undefined))
  const [error, setError] = useState<{ field: DraftField; text: string } | null>(null)
  const save = useMutation({
    mutationFn: (body: Parameters<typeof saveCustomerSegment>[1]) =>
      saveCustomerSegment(segment?.id ?? null, body),
    onSuccess: async () => {
      toast.success(t(`${S}.saved`))
      await client.invalidateQueries({ queryKey: ["customer-segments"] })
      await client.invalidateQueries({ queryKey: ["customer-groups"] })
      onClose()
    },
    onError: (failure) => {
      toast.error(errorText(t, failure))
    },
  })
  const change = (next: Partial<SegmentDraft>) => {
    setDraft({ ...draft, ...next })
  }
  const errorOf = (field: DraftField) => (error?.field === field ? error.text : undefined)
  const text = (field: "minSpent" | "minOrders" | "withinDays" | "lapsedDays", hint?: string) => (
    <Field
      label={t(`${S}.${field}`)}
      htmlFor={`segment-${field}`}
      error={errorOf(field)}
      hint={hint}
    >
      <Input
        id={`segment-${field}`}
        inputMode={field === "minSpent" ? "decimal" : "numeric"}
        value={draft[field]}
        onChange={(event) => {
          change({ [field]: event.target.value })
        }}
      />
    </Field>
  )
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          onClose()
        }
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            const result = rulesOf(draft)
            if ("error" in result) {
              setError({ field: result.field, text: t(result.error) })
              return
            }
            setError(null)
            save.mutate(result)
          }}
        >
          <DialogHeader>
            <DialogTitle>{t(segment ? `${S}.dialogEdit` : `${S}.dialogNew`)}</DialogTitle>
            <DialogDescription>{t(`${S}.dialogDescription`)}</DialogDescription>
          </DialogHeader>
          <Field label={t(`${S}.name`)} htmlFor="segment-name" error={errorOf("name")} required>
            <Input
              id="segment-name"
              autoFocus
              maxLength={100}
              value={draft.name}
              onChange={(event) => {
                change({ name: event.target.value })
              }}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            {text("minSpent")}
            {text("minOrders")}
            {text("withinDays")}
            {text("lapsedDays", t(`${S}.lapsedHint`))}
            <TristateField
              id="segment-registered"
              label={t(`${S}.registered`)}
              yes={t(`${S}.registeredYes`)}
              no={t(`${S}.registeredNo`)}
              value={draft.registered}
              onChange={(registered) => {
                change({ registered })
              }}
            />
            <TristateField
              id="segment-consent"
              label={t(`${S}.consent`)}
              yes={t(`${S}.consentYes`)}
              no={t(`${S}.consentNo`)}
              value={draft.consent}
              onChange={(consent) => {
                change({ consent })
              }}
            />
          </div>
          {error?.field === "rules" ? (
            <p role="alert" className="text-sm text-destructive-text">
              {error.text}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t(`${S}.cancel`)}
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {t(`${S}.save`)}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
