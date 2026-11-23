import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { useFieldArray, useForm, useWatch } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { CardForm } from "@qticaret/admin-ui/patterns/card-form"
import { scopeCategoryOf } from "@/features/products/addon-templates/addon-scope"
import type { ScopeCategory } from "@/features/products/addon-templates/addon-scope"
import { AddonScopeFields } from "@/features/products/addon-templates/addon-scope-fields"
import { ProductAddonTemplates } from "@/features/products/addon-templates/product-addon-templates"
import { useAddonScope } from "@/features/products/addon-templates/use-addon-scope"
import type { ProductAddonTemplate } from "@/features/products/api/addon-templates"
import { ADDONS_FLAG, ADDON_LIMITS } from "@/features/products/api/addons"
import type { ProductAddon } from "@/features/products/api/addons"
import { productCatalogQuery, useSaveCatalog } from "@/features/products/api/product-edit"
import type { SectionFindings } from "@/features/content/section-findings"
import { featuresQuery, useFeatureState } from "@/features/settings/api/features"
import { FULL_RESET } from "@qticaret/admin-ui/lib/forms"
import { addonsFailureOf } from "./addon-failure"
import type { AddonsFailure } from "./addon-failure"
import { AddonCopyDialog } from "./addon-copy-dialog"
import { AddonDialog } from "./addon-dialog"
import { AddonNotice } from "./addon-notice"
import { AddonRow } from "./addon-row"
import { AddonToolbar } from "./addon-toolbar"
import { inputOf, valueOf } from "./addon-values"
import { productFold, someNames } from "./sections"
import { useAddonsShown } from "./use-addons-shown"
import type { AddonValue } from "./addon-values"

const A = "products.addons"

interface Values {
  items: AddonValue[]
}

/** Which add-on the dialog edits: an index in the list, or null for a new one. */
type Editing = { index: number | null } | null

const valuesOf = (addons: readonly ProductAddon[]): Values => ({ items: addons.map(valueOf) })

function AddonsForm({
  productId,
  saved,
  templates,
  hidden,
  flagOn,
  fold,
  category,
}: {
  productId: string
  saved: readonly ProductAddon[]
  /** Add-on templates it reaches, live (adr/0052 Ek 2026-11-23). */
  templates: readonly ProductAddonTemplate[]
  hidden: number
  flagOn: boolean
  fold?: SectionFindings | undefined
  category: ScopeCategory | null
}) {
  const { t } = useTranslation()
  const client = useQueryClient()
  const save = useSaveCatalog(productId)
  const values = valuesOf(saved)
  const form = useForm<Values>({ values, resetOptions: { keepDirtyValues: true } })
  const list = useFieldArray({ control: form.control, name: "items", keyName: "fieldKey" })
  const items = useWatch({ control: form.control, name: "items" })
  const [editing, setEditing] = useState<Editing>(null)
  const [copying, setCopying] = useState(false)
  const [failure, setFailure] = useState<AddonsFailure | null>(null)
  // A refusal of the open dialog's save, said in it
  const [dialogFailure, setDialogFailure] = useState<AddonsFailure | null>(null)
  // A new add-on kept as the product's own, or saved as a template applied to products
  const scoped = useAddonScope(productId, templates, category, flagOn)
  // A cart line names its add-on by id: one removed stops those carts at checkout
  const removed = saved.some((addon) => !items.some((item) => item.id === addon.id))

  // The whole list, in its order; ids kept, new ones without (the server gives them)
  const send = (next: AddonValue[], fail: (failure: AddonsFailure) => void, done?: () => void) => {
    save.mutate(
      { addons: next.length === 0 ? null : next.map(inputOf) },
      {
        onSuccess: (stored) => {
          setFailure(null)
          setDialogFailure(null)
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

  const saveFromDialog = (value: AddonValue) => {
    if (!editing) {
      return
    }
    if (editing.index === null && scoped.scope.mode === "template") {
      void scoped.apply(value, {
        done: () => {
          setEditing(null)
        },
        fail: setDialogFailure,
      })
      return
    }
    const current = form.getValues("items")
    const next =
      editing.index === null
        ? [...current, value]
        : current.map((item, index) => (index === editing.index ? value : item))
    send(next, setDialogFailure, () => {
      setEditing(null)
    })
  }

  const edit = (index: number | null) => {
    setDialogFailure(null)
    if (index === null) {
      scoped.reset()
    }
    setEditing({ index })
  }

  // Template add-ons count toward the five
  const fromTemplates = templates.reduce((sum, template) => sum + template.addons.length, 0)
  const full = list.fields.length + fromTemplates >= ADDON_LIMITS.addons
  const room = ADDON_LIMITS.addons - saved.length - fromTemplates
  return (
    <>
      <CardForm
        title={t(`${A}.title`)}
        description={t(`${A}.description`)}
        collapse={
          fold &&
          productFold(
            t,
            "addons",
            fold,
            [
              saved.length + fromTemplates > 0
                ? t("products.sections.addons", { count: saved.length + fromTemplates })
                : t("products.sections.noAddons"),
              saved.length + fromTemplates > 0
                ? someNames(
                    [
                      ...saved.map((addon) => addon.label),
                      ...templates.flatMap((template) =>
                        template.addons.map((addon) => addon.label)
                      ),
                    ],
                    3
                  )
                : undefined,
              flagOn ? undefined : t("products.sections.addonsOff"),
            ],
            // A save refused: it opens to say why
            failure !== null
          )
        }
        dirty={form.formState.isDirty}
        saving={save.isPending && editing === null && !copying}
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
                  edit(index)
                }}
                onRemove={() => {
                  list.remove(index)
                }}
              />
            ))}
          </ol>
        )}
        {flagOn ? (
          <AddonToolbar
            full={full}
            onAdd={() => {
              edit(null)
            }}
            onCopy={() => {
              setDialogFailure(null)
              setCopying(true)
            }}
          />
        ) : null}
        {flagOn || templates.length > 0 ? (
          <ProductAddonTemplates
            productId={productId}
            templates={templates}
            room={room}
            hidden={hidden}
            flagOn={flagOn}
          />
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
      {/* Outside the card's form: a submit in a dialog would bubble to it through the portal */}
      {editing ? (
        <AddonDialog
          items={items}
          index={editing.index}
          onGo={edit}
          saving={save.isPending || scoped.saving}
          failure={dialogFailure}
          onClose={() => {
            setEditing(null)
          }}
          onSave={saveFromDialog}
          {...(editing.index === null && scoped.scope.mode === "template"
            ? { note: t("products.addonScope.note") }
            : {})}
        >
          {editing.index === null ? (
            <AddonScopeFields value={scoped.scope} onChange={scoped.setScope} category={category} />
          ) : null}
        </AddonDialog>
      ) : null}
      {copying ? (
        <AddonCopyDialog
          productId={productId}
          current={saved.length}
          saving={save.isPending}
          failure={dialogFailure}
          onClose={() => {
            setCopying(false)
          }}
          onCopy={(copied) => {
            send(copied, setDialogFailure, () => {
              setCopying(false)
            })
          }}
        />
      ) : null}
    </>
  )
}

/**
 * Add-ons a shopper picks beside the variant (adr/0052 §11): a typed text
 * or one of a few choices, priced on the server. Shown while the shop's
 * add-ons are on, or while this product still has some. With `fold`,
 * folded under the product page's main parts to their count and names.
 */
export function AddonsCard({
  productId,
  fold,
}: {
  productId: string
  /** The advisor's findings for it: folded, counted in its line, an urgent one opens it. */
  fold?: SectionFindings
}) {
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
  return (
    <AddonsForm
      productId={productId}
      saved={catalog.data.addons}
      templates={catalog.data.addon_templates ?? []}
      hidden={catalog.data.addons_hidden ?? 0}
      flagOn={flagOn}
      fold={fold}
      category={scopeCategoryOf(catalog.data)}
    />
  )
}
