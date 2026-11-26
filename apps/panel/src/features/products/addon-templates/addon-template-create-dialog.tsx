import { useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { FormDialog } from "@qticaret/admin-ui/patterns/form-dialog"
import { Field } from "@qticaret/admin-ui/patterns/form-section"
import { useDiscardGuard } from "@qticaret/admin-ui/patterns/use-discard-guard"
import { DialogBody } from "@qticaret/admin-ui/ui/dialog"
import { Input } from "@qticaret/admin-ui/ui/input"
import { useSaveAddonTemplate } from "@/features/products/api/addon-templates"
import { ADDON_LIMITS } from "@/features/products/api/addons"
import type { AddonsFailure } from "@/features/products/detail/addon-failure"
import { AddonNotice } from "@/features/products/detail/addon-notice"
import { templateFailureOf } from "./template-failure"

const T = "products.addonTemplates"

/**
 * "Ek seçenek grubu ekle": the template's name, the one thing it needs; saving
 * makes it and opens its page, where its add-ons are added (adr/0052 Ek
 * 2026-11-23).
 */
export function AddonTemplateCreateDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const save = useSaveAddonTemplate()
  const [name, setName] = useState("")
  const [failure, setFailure] = useState<AddonsFailure | null>(null)
  const guard = useDiscardGuard(name !== "")
  const submit = () => {
    if (!name.trim()) {
      setFailure({ text: t(`${T}.errors.name`), features: false })
      return
    }
    save.mutate(
      { id: null, name: name.trim(), addons: [] },
      {
        onSuccess: (created) => {
          onClose()
          void navigate({
            to: "/settings/attributes/addon-templates/$id",
            params: { id: created.id },
          })
        },
        onError: (error) => {
          setFailure(templateFailureOf(t, error, true))
        },
      }
    )
  }
  return (
    <FormDialog
      open
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
      title={t(`${T}.new`)}
      description={t(`${T}.createHint`)}
      dirty={name !== ""}
      saving={save.isPending}
      onSubmit={submit}
      guard={guard}
      initialFocus="addon-template-new-name"
    >
      <DialogBody>
        <Field
          label={t(`${T}.name`)}
          htmlFor="addon-template-new-name"
          hint={t(`${T}.nameHint`, { max: ADDON_LIMITS.label })}
          required
        >
          <Input
            placeholder={t("products.placeholders.addonGroup")}
            id="addon-template-new-name"
            value={name}
            maxLength={ADDON_LIMITS.label}
            onChange={(event) => {
              setName(event.target.value)
            }}
          />
        </Field>
        {failure ? <AddonNotice tone="danger" {...failure} /> : null}
      </DialogBody>
    </FormDialog>
  )
}
