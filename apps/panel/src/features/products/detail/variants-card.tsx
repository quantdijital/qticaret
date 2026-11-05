import { zodResolver } from "@hookform/resolvers/zod"
import { useQuery } from "@tanstack/react-query"
import { useLayoutEffect, useRef, useState } from "react"
import type { ReactNode } from "react"
import { useForm } from "react-hook-form"
import type { FieldErrors } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { CardForm } from "@/components/patterns/card-form"
import { useRevealTarget } from "@/components/patterns/use-section-open"
import { Table } from "@/components/ui/table"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { shopDefaultsQuery } from "@/features/products/api/lookups"
import { productCatalogQuery, useSaveVariants } from "@/features/products/api/product-edit"
import type { ProductDetail } from "@/features/products/api/products"
import { useFeature } from "@/features/settings/api/features"
import { errorText } from "@/lib/errors"
import { FULL_RESET } from "@/lib/forms"
import { cn } from "@/lib/utils"
import { VARIANT_CODES_TARGET } from "./sections"
import { firstUncoded } from "./variant-codes"
import { VariantCodesRow } from "./variant-codes-row"
import { VariantRow } from "./variant-row"
import { ROW_FIELDS, savedRows, variantEdits, variantsSchemaFor } from "./variant-values"
import type { VariantValues } from "./variant-values"

type View = "prices" | "codes"
const CODE_FIELDS: readonly string[] = ["sku", "gtin", "mpn"]

// The variant's name stays in sight while a narrow table scrolls sideways; the head's tint
// is laid over the card's colour so the cells sliding under it do not show through
const STICKY_HEAD =
  "sticky left-0 z-10 bg-card before:absolute before:inset-0 before:bg-muted/60 before:content-['']"

function Head({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <th
      scope="col"
      className={cn("px-2 py-2 text-left align-bottom text-xs font-medium", className)}
    >
      <span className="relative text-muted-foreground">{children}</span>
    </th>
  )
}

/**
 * Each variant's price, unit cost, stock and preorder, and in a second
 * view its codes (SKU, barcode, MPN), edited in place and saved together.
 */
export function VariantsCard({
  product,
  className,
}: {
  product: ProductDetail
  className?: string
}) {
  const { t } = useTranslation()
  const defaults = useQuery(shopDefaultsQuery())
  const locationId = defaults.data?.locationId ?? null
  const save = useSaveVariants(product.id)
  const variants = [...(product.variants ?? [])].sort(
    (a, b) => (a.variant_rank ?? 0) - (b.variant_rank ?? 0)
  )
  // Selling past stock needs the preorder flag; a variant already on can still be turned off
  const preorderOn = useFeature("stock.preorder")
  const preorder = preorderOn || variants.some((variant) => variant.allow_backorder)
  // Unit costs and MPNs are the catalog's (F11.4); the rows wait for them so an edit starts from them
  const catalog = useQuery(productCatalogQuery(product.id))
  const extras = new Map((catalog.data?.variants ?? []).map((row) => [row.id, row]))
  const saved = savedRows(variants, locationId, extras)
  const form = useForm<VariantValues>({
    resolver: zodResolver(variantsSchemaFor(saved)),
    values: saved,
    resetOptions: { keepDirtyValues: true },
  })

  const [view, setView] = useState<View>("prices")
  // A field to put the caret in once its view is drawn; `quiet` when the page scrolls to it anyway
  const [focusOn, setFocusOn] = useState<{ name: string; quiet: boolean } | null>(null)
  const table = useRef<HTMLDivElement>(null)
  const target = firstUncoded(saved.rows)
  // The advisor's "go to field": a missing price to this view, a missing barcode to the codes'
  useRevealTarget("product-variants", () => {
    setView("prices")
  })
  useRevealTarget(VARIANT_CODES_TARGET, () => {
    setView("codes")
    setFocusOn({ name: `rows.${String(target)}.gtin`, quiet: true })
  })
  useLayoutEffect(() => {
    const input = focusOn
      ? table.current?.querySelector<HTMLInputElement>(`input[name="${focusOn.name}"]`)
      : null
    if (focusOn && input) {
      input.focus({ preventScroll: focusOn.quiet })
      setFocusOn(null)
    }
  }, [focusOn, view])

  // A refused value in the other view: that view opens with the caret in it
  const showError = (errors: FieldErrors<VariantValues>) => {
    const index = variants.findIndex((_variant, at) => errors.rows?.[at] !== undefined)
    const row = errors.rows?.[index]
    const field = ROW_FIELDS.find((name) => row?.[name])
    if (field) {
      setView(CODE_FIELDS.includes(field) ? "codes" : "prices")
      setFocusOn({ name: `rows.${String(index)}.${field}`, quiet: false })
    }
  }

  const submit = form.handleSubmit((values) => {
    save.mutate(
      {
        edits: variantEdits(variants, values, form.formState.dirtyFields.rows, locationId),
        locationId,
      },
      {
        onSuccess: () => {
          form.reset(values, FULL_RESET)
          toast.success(t("products.detail.variantsSaved"))
        },
        onError: (failure) => toast.error(errorText(t, failure)),
      }
    )
  }, showError)

  const codes = view === "codes"
  return (
    <CardForm
      title={t("products.detail.variants")}
      description={t(
        codes
          ? "products.detail.codes.hint"
          : locationId
            ? "products.detail.variantsHint"
            : "products.detail.variantsNoLocation"
      )}
      action={
        <ToggleGroup
          type="single"
          size="sm"
          variant="outline"
          value={view}
          aria-label={t("products.detail.codes.view")}
          onValueChange={(next) => {
            if (next) {
              setView(next as View)
            }
          }}
        >
          {(["prices", "codes"] as const).map((each) => (
            <ToggleGroupItem
              key={each}
              value={each}
              className="px-3 text-xs data-[state=on]:bg-accent data-[state=on]:text-accent-foreground"
            >
              {t(`products.detail.codes.views.${each}`)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      }
      {...(className ? { className } : {})}
      dirty={form.formState.isDirty}
      saving={save.isPending}
      onSubmit={() => void submit()}
      onReset={() => {
        form.reset(saved, FULL_RESET)
      }}
    >
      <div ref={table} className="-mx-5 border-y">
        <Table>
          <thead className="bg-muted/60">
            <tr>
              <Head className={cn(STICKY_HEAD, "pl-5")}>{t("products.wizard.variant")}</Head>
              {codes ? (
                <>
                  <Head className="w-[24%]">{t("products.detail.codes.sku")}</Head>
                  <Head className="w-[24%]">{t("products.detail.codes.gtin")}</Head>
                  <Head className="w-[24%] pr-5">{t("products.detail.codes.mpn")}</Head>
                </>
              ) : (
                <>
                  <Head className="w-px">{t("products.wizard.price")}</Head>
                  <Head className="w-px">
                    <span title={t("products.detail.costHint")}>{t("products.detail.cost")}</span>
                  </Head>
                  <Head className="w-px">{t("products.wizard.stock")}</Head>
                  <Head className={cn("text-right", !preorder && "pr-5")}>
                    {t("products.detail.reserved")}
                  </Head>
                  {preorder ? (
                    <Head className="pr-5 text-right whitespace-nowrap">
                      {t("products.detail.backorder")}
                    </Head>
                  ) : null}
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {variants.map((variant, index) =>
              codes ? (
                <VariantCodesRow
                  key={variant.id}
                  variant={variant}
                  index={index}
                  form={form}
                  saved={saved.rows[index]}
                  target={index === target}
                />
              ) : (
                <VariantRow
                  key={variant.id}
                  variant={variant}
                  index={index}
                  form={form}
                  locationId={locationId}
                  preorder={preorder}
                  preorderOn={preorderOn}
                />
              )
            )}
          </tbody>
        </Table>
      </div>
    </CardForm>
  )
}
