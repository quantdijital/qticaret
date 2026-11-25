import { useState } from "react"
import { useTranslation } from "react-i18next"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { useDiscardGuard } from "@qticaret/admin-ui/patterns/use-discard-guard"
import { useRevealTarget } from "@qticaret/admin-ui/hooks/use-section-open"
import type { ProductDetail } from "@/features/products/api/products"
import { VARIANT_CODES_TARGET } from "./sections"
import { SingleVariantCard } from "./single-variant-card"
import { firstUncoded, savedCodes } from "./variant-codes"
import { variantFacts } from "./variant-facts"
import { VariantBulkBar } from "./variant-bulk-bar"
import { groupVariants } from "./variant-grouping"
import { VariantGroupHead, VariantListHead } from "./variant-groups"
import { VariantInlineForm } from "./variant-inline-form"
import { VariantListRow } from "./variant-list-row"
import { VariantOptionsEditor } from "./variant-options-editor"
import { savedOptions } from "./variant-options"
import type { Placeholder } from "./variant-options"
import { priceOf } from "./variant-values"
import type { Variant } from "./variant-values"
import { useVariantContext } from "./use-variant-context"

const D = "products.variant"

type Open = { id: string; focus: string | null } | null

/** The option a product of no options gets (the wizard's): left out of the editor. */
function usePlaceholder(): Placeholder {
  const { t } = useTranslation()
  return {
    title: t("products.wizard.defaultOption"),
    value: t("products.wizard.defaultValue"),
  }
}

/**
 * The product's variants (docs/06 "Ürün sayfası", the owner 2026-11-25:
 * WooCommerce's variations, no dialog): its options typed as chips and
 * "Varyantları oluştur" on top, a bulk change for many, and one row each
 * that opens in place with everything about the variant. A product of one
 * variant has its price, stock and codes right in its card
 * (`SingleVariantCard`), its options under it.
 */
export function VariantsCard({ product }: { product: ProductDetail }) {
  if ((product.variants?.length ?? 0) <= 1) {
    return <SingleVariant product={product} />
  }
  return <VariantList product={product} />
}

function SingleVariant({ product }: { product: ProductDetail }) {
  const { t } = useTranslation()
  const placeholder = usePlaceholder()
  const [editing, setEditing] = useState(false)
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <SingleVariantCard product={product} />
      <SectionCard title={t(`${D}.options.title`)} flush>
        <div className="border-t">
          <VariantOptionsEditor
            product={product}
            placeholder={placeholder}
            open={editing}
            onOpenChange={setEditing}
          />
        </div>
      </SectionCard>
    </div>
  )
}

function VariantList({ product }: { product: ProductDetail }) {
  const { t } = useTranslation()
  const placeholder = usePlaceholder()
  const context = useVariantContext(product)
  const { variants, locationId, catalog, displays } = context
  const options = savedOptions(product, placeholder)
  const [editing, setEditing] = useState(false)
  const [open, setOpen] = useState<Open>(null)
  // Whether the open row holds something not kept: another row or closing asks first
  const [openDirty, setOpenDirty] = useState(false)
  const guard = useDiscardGuard(openDirty)
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set())
  const [folded, setFolded] = useState<ReadonlySet<string>>(new Set())
  const groups = groupVariants(product, variants, options)

  const openRow = (variant: Variant | undefined, focus: string | null) => {
    if (!variant) {
      return
    }
    guard.guard(() => {
      setOpen({ id: variant.id, focus })
      // Its group unfolds
      setFolded(new Set())
    })
  }
  // The advisor's "Alana git": a missing price opens that variant, a missing barcode its codes
  useRevealTarget("product-variants", () => {
    openRow(
      variants.find((variant) => priceOf(variant) === null),
      "variant-price"
    )
  })
  useRevealTarget(VARIANT_CODES_TARGET, () => {
    const index = firstUncoded(
      variants.map((variant) => savedCodes(variant, catalog.get(variant.id)))
    )
    openRow(variants[index], VARIANT_CODES_TARGET)
  })
  const pick = (ids: readonly string[], on: boolean) => {
    const next = new Set(selected)
    for (const id of ids) {
      if (on) {
        next.add(id)
      } else {
        next.delete(id)
      }
    }
    setSelected(next)
  }

  const row = (variant: Variant) => {
    const facts = variantFacts(
      product,
      variant,
      locationId,
      catalog.get(variant.id),
      displays.get(variant.id)
    )
    const isOpen = open?.id === variant.id
    return (
      <VariantListRow
        key={variant.id}
        facts={facts}
        disabled={!context.ready}
        open={isOpen && context.ready}
        selected={selected.has(variant.id)}
        onSelect={(on) => {
          pick([variant.id], on)
        }}
        onToggle={() => {
          guard.guard(() => {
            setOpen(isOpen ? null : { id: variant.id, focus: null })
          })
        }}
      >
        <VariantInlineForm
          // A new form for each variant: it starts from what is stored
          key={variant.id}
          product={product}
          variant={variant}
          locationId={locationId}
          catalog={catalog.get(variant.id)}
          sale={facts.sale}
          preorder={context.preorder}
          preorderOn={context.preorderOn}
          focus={isOpen ? open.focus : null}
          onDirtyChange={setOpenDirty}
          onClose={() => {
            setOpen(null)
          }}
        />
      </VariantListRow>
    )
  }

  return (
    <SectionCard
      title={t(`${D}.listTitle`, { count: variants.length })}
      description={t(`${D}.listHint`)}
      flush
    >
      <div className="border-t">
        <VariantOptionsEditor
          product={product}
          placeholder={placeholder}
          open={editing}
          onOpenChange={setEditing}
        />
      </div>
      <VariantBulkBar
        product={product}
        variants={variants}
        options={options}
        locationId={locationId}
        selected={selected}
        onDone={() => {
          setSelected(new Set())
        }}
      />
      <VariantListHead
        all={variants.length > 0 && selected.size === variants.length}
        some={selected.size > 0}
        onPick={(on) => {
          pick(
            variants.map((variant) => variant.id),
            on
          )
        }}
      />
      {groups ? (
        <div className="flex flex-col divide-y">
          {groups.map((group) => {
            const ids = group.variants.map((variant) => variant.id)
            const closed = folded.has(group.key)
            return (
              <section key={group.key} aria-label={group.label}>
                <VariantGroupHead
                  label={group.label}
                  count={ids.length}
                  open={!closed}
                  picked={ids.filter((id) => selected.has(id)).length}
                  onToggle={() => {
                    const next = new Set(folded)
                    if (closed) {
                      next.delete(group.key)
                    } else {
                      next.add(group.key)
                    }
                    setFolded(next)
                  }}
                  onPick={(on) => {
                    pick(ids, on)
                  }}
                />
                {closed ? null : (
                  <ul className="flex flex-col divide-y border-t">{group.variants.map(row)}</ul>
                )}
              </section>
            )
          })}
        </div>
      ) : (
        <ul className="flex flex-col divide-y border-t sm:border-t-0">{variants.map(row)}</ul>
      )}
      {guard.confirm}
    </SectionCard>
  )
}
