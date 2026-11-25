import { Loader2, Plus, X } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { ChipInput } from "@qticaret/admin-ui/patterns/chip-input"
import { useDirtyEntry } from "@qticaret/admin-ui/patterns/dirty-registry"
import { useDiscardGuard } from "@qticaret/admin-ui/patterns/use-discard-guard"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Input } from "@qticaret/admin-ui/ui/input"
import { useApplyVariantPlan } from "@/features/products/api/product-options"
import type { ProductDetail } from "@/features/products/api/products"
import { errorText } from "@/lib/errors"
import {
  draftChanged,
  draftProblem,
  MAX_OPTIONS,
  planVariants,
  savedOptions,
  usedValues,
} from "./variant-options"
import type { OptionDraft, Placeholder } from "./variant-options"

const D = "products.variant.options"
const W = "products.wizard.options"

function ValueChips({
  option,
  used,
  onChange,
  onRefused,
}: {
  option: OptionDraft
  used: ReadonlySet<string>
  onChange: (values: string[]) => void
  onRefused: (value: string) => void
}) {
  const { t } = useTranslation()
  const [text, setText] = useState("")
  const add = () => {
    const values = text
      .split(",")
      .map((value) => value.trim())
      .filter(
        (value, at, all) => value && !option.values.includes(value) && all.indexOf(value) === at
      )
    if (values.length > 0) {
      onChange([...option.values, ...values])
    }
    setText("")
  }
  return (
    <ChipInput
      chips={option.values.map((value) => ({ key: value, label: value }))}
      text={text}
      onTextChange={setText}
      onCommit={add}
      onRemove={(index) => {
        const value = option.values[index]
        // A value a variant stands for stays: nothing here deletes a variant
        if (value !== undefined && option.id !== null && used.has(value)) {
          onRefused(value)
          return
        }
        onChange(option.values.filter((_, at) => at !== index))
      }}
      removeLabel={(value) => t(`${W}.removeValue`, { value })}
      aria-label={t(`${W}.values`, { option: option.title || t(`${W}.name`) })}
      placeholder={t(`${W}.valuesPlaceholder`)}
    />
  )
}

/**
 * The product's options and their values, typed as chips (the owner,
 * 2026-11-25: WooCommerce's variations, no dialog): "Varyantları oluştur"
 * saves the options and makes every combination the product has no
 * variant for, counted on the button first. Nothing is deleted: a value or
 * an option a variant stands for cannot be taken off here. Its changes join
 * the page's save bar.
 */
export function VariantOptionsEditor({
  product,
  placeholder,
  open,
  onOpenChange,
}: {
  product: ProductDetail
  placeholder: Placeholder
  /** Its fields shown; closed it is one line of the options and their values. */
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const saved = savedOptions(product, placeholder)
  const [drafts, setDrafts] = useState<OptionDraft[]>(saved)
  const [refused, setRefused] = useState<string | null>(null)
  const apply = useApplyVariantPlan(product.id)
  const used = usedValues(product)
  const dirty = draftChanged(saved, drafts)
  const guard = useDiscardGuard(dirty)
  const problem = draftProblem(drafts)
  const plan = planVariants(product, drafts, placeholder)
  const suggestions = t(`${W}.suggestions`, { returnObjects: true }) as string[]
  const titles = new Set(drafts.map((draft) => draft.title.trim()))

  const reset = () => {
    setDrafts(saved)
    setRefused(null)
  }
  const submit = () => {
    if (problem) {
      return
    }
    apply.mutate(plan, {
      onSuccess: () => {
        toast.success(
          plan.create.length > 0
            ? t(`${D}.created`, { count: plan.create.length })
            : t(`${D}.saved`)
        )
        onOpenChange(false)
      },
      onError: (failure) => toast.error(errorText(t, failure)),
    })
  }
  // Saved, the product is read again: the draft follows what is stored
  const [stored, setStored] = useState(saved)
  if (draftChanged(stored, saved)) {
    setStored(saved)
    setDrafts(saved)
  }
  useDirtyEntry({ dirty, saving: apply.isPending, submit, reset })

  const update = (index: number, next: OptionDraft) => {
    setRefused(null)
    setDrafts(drafts.map((draft, at) => (at === index ? next : draft)))
  }
  const summary = saved.map((option) => `${option.title}: ${option.values.join(", ")}`).join(" · ")

  if (!open) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 py-3">
        <p className="min-w-0 flex-[1_1_16rem] text-[13px] text-muted-foreground">
          {summary ? (
            <>
              <span className="font-medium text-foreground">{t(`${D}.title`)}: </span>
              {summary}
            </>
          ) : (
            t(`${D}.none`)
          )}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            onOpenChange(true)
          }}
        >
          {summary ? t(`${D}.edit`) : t(`${D}.add`)}
        </Button>
      </div>
    )
  }

  const removable = (draft: OptionDraft) =>
    draft.id === null || !draft.values.some((value) => used.get(draft.title)?.has(value))
  const button =
    plan.create.length > 0 ? t(`${D}.create`, { count: plan.create.length }) : t(`${D}.save`)
  return (
    <div className="flex flex-col gap-3 px-5 py-4" data-variant-options="">
      <p className="text-[13px] text-muted-foreground">{t(`${D}.hint`)}</p>
      {drafts.map((draft, index) => (
        <div
          key={draft.id ?? `new-${index}`}
          className="grid gap-2 rounded-lg border bg-background/60 p-3 sm:grid-cols-[11rem_minmax(0,1fr)_auto] sm:items-start"
        >
          <Input
            value={draft.title}
            // A stored option keeps its name: its values and variants hang on it
            readOnly={draft.id !== null}
            aria-label={t(`${W}.name`)}
            placeholder={t(`${W}.namePlaceholder`)}
            onChange={(event) => {
              update(index, { ...draft, title: event.target.value })
            }}
          />
          <ValueChips
            option={draft}
            used={used.get(draft.title) ?? new Set()}
            onChange={(values) => {
              update(index, { ...draft, values })
            }}
            onRefused={setRefused}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={!removable(draft)}
            title={removable(draft) ? undefined : t(`${D}.optionUsed`)}
            aria-label={t(`${W}.remove`)}
            onClick={() => {
              setDrafts(drafts.filter((_, at) => at !== index))
            }}
          >
            <X />
          </Button>
        </div>
      ))}
      {refused ? (
        <p className="text-[13px] text-warning-text" role="status">
          {t(`${D}.valueUsed`, { value: refused })}
        </p>
      ) : null}
      {drafts.length < MAX_OPTIONS ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setDrafts([...drafts, { id: null, title: "", values: [] }])
            }}
          >
            <Plus />
            {t(`${W}.add`)}
          </Button>
          {suggestions
            .filter((title) => !titles.has(title))
            .map((title) => (
              <button
                key={title}
                type="button"
                onClick={() => {
                  setDrafts([...drafts, { id: null, title, values: [] }])
                }}
                className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground hover:border-input hover:text-foreground"
              >
                + {title}
              </button>
            ))}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t pt-3">
        <p
          className="min-w-0 flex-[1_1_14rem] text-[13px] text-muted-foreground"
          aria-live="polite"
        >
          {problem
            ? t(`${D}.problems.${problem}`)
            : plan.create.length > 0
              ? t(`${D}.preview`, { count: plan.create.length })
              : t(`${D}.nothingNew`)}
          {plan.fill.length > 0 && !problem
            ? ` ${t(`${D}.fill`, { count: plan.fill.length })}`
            : ""}
        </p>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={apply.isPending}
            onClick={() => {
              guard.guard(() => {
                reset()
                onOpenChange(false)
              })
            }}
          >
            {t("common.cancel")}
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={apply.isPending || problem !== null || (!dirty && plan.create.length === 0)}
            onClick={submit}
          >
            {apply.isPending ? <Loader2 className="animate-spin" /> : null}
            {button}
          </Button>
        </div>
      </div>
      {guard.confirm}
    </div>
  )
}
