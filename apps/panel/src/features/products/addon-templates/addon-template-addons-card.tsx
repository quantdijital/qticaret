import { Plus } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { CardForm } from "@qticaret/admin-ui/patterns/card-form"
import { Button } from "@qticaret/admin-ui/ui/button"
import { useSaveAddonTemplate } from "@/features/products/api/addon-templates"
import type { AddonTemplate } from "@/features/products/api/addon-templates"
import { ADDON_LIMITS } from "@/features/products/api/addons"
import { AddonDialog } from "@/features/products/detail/addon-dialog"
import type { AddonsFailure } from "@/features/products/detail/addon-failure"
import { AddonNotice } from "@/features/products/detail/addon-notice"
import { AddonRow } from "@/features/products/detail/addon-row"
import { inputOf, valueOf } from "@/features/products/detail/addon-values"
import type { AddonValue } from "@/features/products/detail/addon-values"
import { templateFailureOf } from "./template-failure"

const T = "products.addonTemplates"

/** Which add-on the dialog edits: an index in the list, or null for a new one. */
type Editing = { index: number | null } | null

const valuesOf = (template: AddonTemplate) => template.addons.map(valueOf)

/**
 * The template's add-ons on its page (adr/0052 Ek 2026-11-23), as the
 * product page's card: a row opens the one add-on dialog, whose save
 * saves the whole list; moving and removing are kept until the card is
 * saved. Every linked product reads the change at once.
 */
export function AddonTemplateAddonsCard({
  template,
  flagOn,
}: {
  template: AddonTemplate
  flagOn: boolean
}) {
  const { t } = useTranslation()
  const save = useSaveAddonTemplate()
  const [items, setItems] = useState<AddonValue[]>(() => valuesOf(template))
  const [editing, setEditing] = useState<Editing>(null)
  const [failure, setFailure] = useState<AddonsFailure | null>(null)
  const [dialogFailure, setDialogFailure] = useState<AddonsFailure | null>(null)
  const dirty = JSON.stringify(items) !== JSON.stringify(valuesOf(template))

  const send = (next: AddonValue[], fail: (failure: AddonsFailure) => void, done?: () => void) => {
    save.mutate(
      { id: template.id, addons: next.map(inputOf) },
      {
        onSuccess: (saved) => {
          setItems(valuesOf(saved))
          setFailure(null)
          setDialogFailure(null)
          done?.()
          toast.success(t(`${T}.saved`))
        },
        onError: (error) => {
          fail(templateFailureOf(t, error, flagOn))
        },
      }
    )
  }

  return (
    <>
      <CardForm
        title={t(`${T}.addons`)}
        description={t(`${T}.addonsHint`, { max: ADDON_LIMITS.addons })}
        dirty={dirty}
        saving={save.isPending && editing === null}
        onSubmit={() => {
          send(items, setFailure)
        }}
        onReset={() => {
          setFailure(null)
          setItems(valuesOf(template))
        }}
      >
        {items.length === 0 ? (
          <p className="rounded-md border border-dashed px-4 py-3 text-[13px] text-muted-foreground">
            {t(`${T}.noAddons`)}
          </p>
        ) : (
          <ol className="flex flex-col divide-y rounded-md border">
            {items.map((item, index) => (
              <AddonRow
                key={item.id ?? `new-${String(index)}`}
                value={item}
                index={index}
                count={items.length}
                readOnly={!flagOn}
                onMove={(to) => {
                  const next = [...items]
                  const [moved] = next.splice(index, 1)
                  if (moved) {
                    next.splice(to, 0, moved)
                  }
                  setItems(next)
                }}
                onEdit={() => {
                  setDialogFailure(null)
                  setEditing({ index })
                }}
                onRemove={() => {
                  setItems(items.filter((_, at) => at !== index))
                }}
              />
            ))}
          </ol>
        )}
        {flagOn ? (
          <div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={items.length >= ADDON_LIMITS.addons}
              onClick={() => {
                setDialogFailure(null)
                setEditing({ index: null })
              }}
            >
              <Plus />
              {t("products.addons.add")}
            </Button>
          </div>
        ) : null}
        <p className="text-xs text-muted-foreground">{t("products.addons.discountNote")}</p>
        {failure ? <AddonNotice tone="danger" {...failure} /> : null}
      </CardForm>
      {/* Outside the card's form: a submit in the dialog would bubble to it through the portal */}
      {editing ? (
        <AddonDialog
          items={items}
          index={editing.index}
          onGo={(index) => {
            setEditing({ index })
          }}
          saving={save.isPending}
          failure={dialogFailure}
          note={t(`${T}.addonNote`)}
          onClose={() => {
            setEditing(null)
          }}
          onSave={(value) => {
            const next =
              editing.index === null
                ? [...items, value]
                : items.map((item, index) => (index === editing.index ? value : item))
            send(next, setDialogFailure, () => {
              setEditing(null)
            })
          }}
        />
      ) : null}
    </>
  )
}
