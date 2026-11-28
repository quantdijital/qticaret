import { Loader2 } from "lucide-react"
import { useEffect } from "react"
import { useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { NumberField } from "@qticaret/admin-ui/patterns/number-field"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Input } from "@qticaret/admin-ui/ui/input"
import { TERM_PREFIX, useUpdateTerm } from "@/features/content/api/terms"
import type { Term, TermInput } from "@/features/content/api/terms"
import { errorText } from "@/lib/errors"
import { FULL_RESET, beginSave } from "@qticaret/admin-ui/lib/forms"
import { toSlug } from "@/lib/slug"

const T = "content.terms"
// The server's bounds (adr/0019 ek 2026-11-03)
const RANK_MAX = 100_000

interface Values {
  name: string
  handle: string
  rank: string
}

const valuesOf = (term: Term): Values => ({
  name: term.name,
  handle: term.handle,
  rank: String(term.rank),
})

/** What changed, as the server takes it; an emptied handle keeps the stored one. */
function bodyOf(values: Values, dirty: Partial<Record<keyof Values, boolean>>): TermInput {
  const rank = Math.trunc(Number(values.rank))
  return {
    ...(dirty.name ? { name: values.name.trim() } : {}),
    ...(dirty.handle && values.handle.trim() !== "" ? { handle: values.handle.trim() } : {}),
    ...(dirty.rank && Number.isFinite(rank) ? { rank: Math.max(0, Math.min(RANK_MAX, rank)) } : {}),
  }
}

/** A term's name, address and place in the shop's order; its text has a tab of its own. */
export function TermForm({
  term,
  onDirtyChange,
}: {
  term: Term
  /** Whether something is typed and not saved: the dialog asks before leaving it. */
  onDirtyChange?: (dirty: boolean) => void
}) {
  const { t } = useTranslation()
  const update = useUpdateTerm(term.id)
  const saved = valuesOf(term)
  const form = useForm<Values>({ values: saved, resetOptions: { keepDirtyValues: true } })
  const name = useWatch({ control: form.control, name: "name" })
  const { isDirty, dirtyFields } = form.formState
  useEffect(() => {
    onDirtyChange?.(isDirty)
  }, [isDirty, onDirtyChange])
  const submit = form.handleSubmit((values) => {
    const settle = beginSave(form)
    if (values.name.trim() === "") {
      form.setError("name", { message: t(`${T}.nameRequired`) })
      return
    }
    update.mutate(bodyOf(values, dirtyFields), {
      onSuccess: (result) => {
        settle(valuesOf(result.term))
        toast.success(t("content.saved"))
      },
      onError: (failure) => toast.error(errorText(t, failure)),
    })
  })
  const id = (field: string) => `term-${term.id}-${field}`
  return (
    <form
      noValidate
      className="flex flex-col gap-5"
      onSubmit={(event) => {
        void submit(event)
      }}
    >
      <Field
        label={t(`${T}.fields.name`)}
        htmlFor={id("name")}
        error={form.formState.errors.name?.message}
        required
      >
        <Input
          placeholder={t("content.placeholders.term")}
          id={id("name")}
          maxLength={120}
          {...form.register("name")}
        />
      </Field>
      <Field label={t(`${T}.fields.handle`)} htmlFor={id("handle")} hint={t(`${T}.handleHint`)}>
        <div className="flex items-center rounded-md border">
          <span className="pl-3 font-mono text-[13px] whitespace-nowrap text-muted-foreground">
            {TERM_PREFIX[term.kind]}
          </span>
          <Input
            id={id("handle")}
            spellCheck={false}
            placeholder={toSlug(name)}
            className="border-0 pl-0 font-mono text-[13px] shadow-none"
            {...form.register("handle")}
          />
        </div>
      </Field>
      <Field label={t(`${T}.fields.rank`)} htmlFor={id("rank")} hint={t(`${T}.rankHint`)}>
        <NumberField
          plain
          id={id("rank")}
          min={0}
          max={RANK_MAX}
          step={1}
          className="w-40"
          {...form.register("rank")}
        />
      </Field>
      <div className="flex justify-end gap-2 border-t pt-4">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={!isDirty || update.isPending}
          onClick={() => {
            form.reset(saved, FULL_RESET)
          }}
        >
          {t("common.reset")}
        </Button>
        <Button type="submit" size="sm" disabled={!isDirty || update.isPending}>
          {update.isPending ? <Loader2 className="animate-spin" /> : null}
          {t("common.save")}
        </Button>
      </div>
    </form>
  )
}
