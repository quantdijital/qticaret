import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Plus } from "lucide-react"
import { useState } from "react"
import { useFieldArray, useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { CardForm } from "@/components/patterns/card-form"
import { Button } from "@/components/ui/button"
import { ADDONS_FLAG, ADDON_LIMITS } from "@/features/products/api/addons"
import type { ProductAddon } from "@/features/products/api/addons"
import { productCatalogQuery, useSaveCatalog } from "@/features/products/api/product-edit"
import { featuresQuery, useFeatureState } from "@/features/settings/api/features"
import { FULL_RESET } from "@/lib/forms"
import { addonsFailureOf } from "./addon-failure"
import type { AddonsFailure } from "./addon-failure"
import { AddonNotice } from "./addon-notice"
import { AddonRow } from "./addon-row"
import { AddonSheet } from "./addon-sheet"
import { inputOf, valueOf } from "./addon-values"
import { useAddonsShown } from "./use-addons-shown"
import type { AddonValue } from "./addon-values"

const A = "products.addons"

interface Values {
  items: AddonValue[]
}

/** Which add-on the sheet edits: an index in the list, or null for a new one. */
type Editing = { index: number | null } | null

const valuesOf = (addons: readonly ProductAddon[]): Values => ({ items: addons.map(valueOf) })

function AddonsForm({
  productId,
  saved,
  flagOn,
}: {
  productId: string
  saved: readonly ProductAddon[]
  flagOn: boolean
}) {
  const { t } = useTranslation()
  const client = useQueryClient()
  const save = useSaveCatalog(productId)
  const values = valuesOf(saved)
  const form = useForm<Values>({ values, resetOptions: { keepDirtyValues: true } })
  const list = useFieldArray({ control: form.control, name: "items", keyName: "fieldKey" })
  const items = useWatch({ control: form.control, name: "items" })
  const [editing, setEditing] = useState<Editing>(null)
  const [failure, setFailure] = useState<AddonsFailure | null>(null)
  const [sheetFailure, setSheetFailure] = useState<AddonsFailure | null>(null)
  // A cart line names its add-on by id: one removed stops those carts at checkout
  const removed = saved.some((addon) => !items.some((item) => item.id === addon.id))

  // The whole list, in its order; ids kept, new ones without (the server gives them)
  const send = (next: AddonValue[], fail: (failure: AddonsFailure) => void, done?: () => void) => {
    save.mutate(
      { addons: next.length === 0 ? null : next.map(inputOf) },
      {
        onSuccess: (stored) => {
          setFailure(null)
          setSheetFailure(null)
          form.reset(valuesOf(stored.addons), FULL_RESET)
          done?.()
          toast.success(t("products.detail.saved"))
        },
        onError: (error) => {
          fail(addonsFailureOf(t, error, flagOn))
          // A flag turned off elsewhere: the card says so once the list is fresh
          void client.invalidateQueries({ queryKey: featuresQuery().queryKey })
        },
      }
    )
  }

  const saveFromSheet = (value: AddonValue) => {
    if (!editing) {
      return
    }
    const current = form.getValues("items")
    const next =
      editing.index === null
        ? [...current, value]
        : current.map((item, index) => (index === editing.index ? value : item))
    send(next, setSheetFailure, () => {
      setEditing(null)
    })
  }

  const full = list.fields.length >= ADDON_LIMITS.addons
  return (
    <>
      <CardForm
        title={t(`${A}.title`)}
        description={t(`${A}.description`)}
        dirty={form.formState.isDirty}
        saving={save.isPending && editing === null}
        onSubmit={() => {
          send(form.getValues("items"), setFailure)
        }}
        onReset={() => {
          setFailure(null)
          form.reset(values, FULL_RESET)
        }}
      >
        {flagOn ? null : <AddonNotice tone="warning" text={t(`${A}.flagOff`)} features />}
        {list.fields.length === 0 ? (
          <p className="rounded-md border border-dashed px-4 py-3 text-[13px] text-muted-foreground">
            {t(`${A}.empty`)}
          </p>
        ) : (
          <ol className="flex flex-col divide-y rounded-md border">
            {list.fields.map((field, index) => (
              <AddonRow
                key={field.fieldKey}
                value={items[index] ?? field}
                index={index}
                count={list.fields.length}
                readOnly={!flagOn}
                onMove={(to) => {
                  list.move(index, to)
                }}
                onEdit={() => {
                  setSheetFailure(null)
                  setEditing({ index })
                }}
                onRemove={() => {
                  list.remove(index)
                }}
              />
            ))}
          </ol>
        )}
        {flagOn ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={full}
              onClick={() => {
                setSheetFailure(null)
                setEditing({ index: null })
              }}
            >
              <Plus />
              {t(`${A}.add`)}
            </Button>
            <span className="text-xs text-muted-foreground">
              {t(`${A}.limit`, { max: ADDON_LIMITS.addons })}
            </span>
          </div>
        ) : null}
        <div className="flex flex-col gap-1 text-xs text-muted-foreground">
          <p>{t(`${A}.example`)}</p>
          <p>{t(`${A}.discountNote`)}</p>
        </div>
        {removed ? (
          <AddonNotice tone="warning" text={t(`${A}.removedNote`)} features={false} />
        ) : null}
        {failure ? <AddonNotice tone="danger" {...failure} /> : null}
      </CardForm>
      {/* Outside the card's form: a submit in the sheet would bubble to it through the portal */}
      {editing ? (
        <AddonSheet
          addon={editing.index === null ? null : (items[editing.index] ?? null)}
          saving={save.isPending}
          failure={sheetFailure}
          onClose={() => {
            setEditing(null)
          }}
          onSave={saveFromSheet}
        />
      ) : null}
    </>
  )
}

/**
 * Add-ons a shopper picks beside the variant (adr/0052 §11): a typed text
 * or one of a few choices, priced on the server. Shown while the shop's
 * add-ons are on, or while this product still has some.
 */
export function AddonsCard({ productId }: { productId: string }) {
  const catalog = useQuery(productCatalogQuery(productId))
  const features = useQuery(featuresQuery())
  const state = useFeatureState(ADDONS_FLAG)
  const shown = useAddonsShown(productId)
  // Unreadable flags read as off: the product's own add-ons still show
  const flagOn = features.isError ? false : state
  // Nothing until both are known: a card that appears and goes would shift the page
  if (!catalog.data || flagOn === undefined || !shown) {
    return null
  }
  return <AddonsForm productId={productId} saved={catalog.data.addons} flagOn={flagOn} />
}
