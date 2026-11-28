import { ChevronDown } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { cn } from "@qticaret/admin-ui/lib/utils"
import { Checkbox } from "@qticaret/admin-ui/ui/checkbox"
import { Label } from "@qticaret/admin-ui/ui/label"
import { SAMPLE_PARTS } from "@/features/sample-catalog/api"
import type { RemovalPlan, SamplePart, SampleProduct } from "@/features/sample-catalog/api"

const R = "sampleCatalog.remove"

const countOf = (plan: RemovalPlan | undefined, part: SamplePart): number | undefined =>
  plan ? plan[part] : undefined

/**
 * The parts to remove, each with what it would take (`dry_run`): a part
 * chosen counts in the chosen plan, one not chosen in the whole plan.
 * "Hepsi" turns all three.
 */
export function RemovalParts({
  parts,
  onParts,
  chosen,
  whole,
}: {
  parts: ReadonlySet<SamplePart>
  onParts: (parts: Set<SamplePart>) => void
  chosen: RemovalPlan | undefined
  whole: RemovalPlan | undefined
}) {
  const { t } = useTranslation()
  const all = SAMPLE_PARTS.every((part) => parts.has(part))
  const count = (value: number | undefined) => (
    <span className="ml-auto text-sm text-muted-foreground tabular-nums">
      {value ?? t(`${R}.counting`)}
    </span>
  )
  return (
    <fieldset className="flex flex-col gap-1 rounded-md border p-1">
      <legend className="sr-only">{t(`${R}.partsLabel`)}</legend>
      <div className="flex items-center gap-3 rounded-md px-3 py-2">
        <Checkbox
          id="sample-part-all"
          checked={all}
          onCheckedChange={(on) => {
            onParts(new Set(on === true ? SAMPLE_PARTS : []))
          }}
        />
        <Label htmlFor="sample-part-all" className="font-medium">
          {t(`${R}.parts.all`)}
        </Label>
      </div>
      {SAMPLE_PARTS.map((part) => {
        const on = parts.has(part)
        const hint = part === "reviews" ? null : t(`${R}.parts.${part}Hint`)
        return (
          <div key={part} className="flex items-start gap-3 rounded-md px-3 py-2 pl-8">
            <Checkbox
              id={`sample-part-${part}`}
              checked={on}
              className="mt-0.5"
              onCheckedChange={(next) => {
                const updated = new Set(parts)
                if (next === true) {
                  updated.add(part)
                } else {
                  updated.delete(part)
                }
                onParts(updated)
              }}
            />
            <div className="flex min-w-0 flex-col">
              <Label htmlFor={`sample-part-${part}`}>{t(`${R}.parts.${part}`)}</Label>
              {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
            </div>
            {count(countOf(on ? chosen : whole, part))}
          </div>
        )
      })}
    </fieldset>
  )
}

/**
 * "Bazılarını tut" (folded at first): the sample products one by one,
 * each ticked to go; one unticked stays a sample (an edited one, say).
 * One an order or a sold place holds is shown, never ticked.
 */
export function KeepList({
  products,
  going,
  onGoing,
}: {
  products: readonly SampleProduct[]
  going: ReadonlySet<string>
  onGoing: (going: Set<string>) => void
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        aria-expanded={open}
        className="flex items-center gap-1.5 self-start text-sm font-medium hover:underline"
        onClick={() => {
          setOpen(!open)
        }}
      >
        <ChevronDown
          className={cn("size-4 transition-transform", open ? "" : "-rotate-90")}
          aria-hidden="true"
        />
        {t(`${R}.keepToggle`)}
      </button>
      {open ? (
        <div className="flex flex-col gap-1">
          <p className="text-xs text-muted-foreground">{t(`${R}.keepHint`)}</p>
          <ul className="flex max-h-60 flex-col overflow-y-auto rounded-md border">
            {products.map((product) => (
              <li
                key={product.id}
                className="flex items-center gap-3 border-b px-3 py-2 last:border-b-0"
              >
                <Checkbox
                  id={`sample-keep-${product.id}`}
                  checked={product.blocked === null && going.has(product.id)}
                  disabled={product.blocked !== null}
                  aria-label={t(`${R}.keepAria`, { title: product.title })}
                  onCheckedChange={(next) => {
                    const updated = new Set(going)
                    if (next === true) {
                      updated.add(product.id)
                    } else {
                      updated.delete(product.id)
                    }
                    onGoing(updated)
                  }}
                />
                <label
                  htmlFor={`sample-keep-${product.id}`}
                  className="min-w-0 flex-1 truncate text-sm"
                  title={product.title}
                >
                  {product.title}
                </label>
                {product.edited ? (
                  <span className="text-xs text-muted-foreground">{t(`${R}.edited`)}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

/**
 * What stays and why: a product an order, a sold place or a customer's
 * words hold (with how many), a category holding the shop's.
 */
export function Stays({ plan }: { plan: Pick<RemovalPlan, "blocked" | "categories_kept"> }) {
  const { t } = useTranslation()
  const lines = [
    ...plan.blocked.map((row) => ({
      key: row.id,
      text: t(`${R}.stays.${row.reason}`, {
        title: row.title,
        count: row.customer_content ?? 0,
      }),
    })),
    ...plan.categories_kept.map((row) => ({
      key: row.id,
      text: t(`${R}.stays.${row.reason}`, { name: row.name }),
    })),
  ]
  if (lines.length === 0) {
    return null
  }
  return (
    <div className="flex flex-col gap-1.5 rounded-md bg-warning-soft px-3 py-2 text-sm text-warning-text">
      <p className="font-medium">{t(`${R}.staysTitle`)}</p>
      <ul className="flex list-disc flex-col gap-0.5 pl-5">
        {lines.map((line) => (
          <li key={line.key}>{line.text}</li>
        ))}
      </ul>
    </div>
  )
}
