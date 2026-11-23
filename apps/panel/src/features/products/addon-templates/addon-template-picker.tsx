import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { Loader2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { DetailDialog } from "@qticaret/admin-ui/patterns/detail-dialog"
import { ErrorState, LoadingRows } from "@qticaret/admin-ui/patterns/states"
import { Button } from "@qticaret/admin-ui/ui/button"
import { DialogBody } from "@qticaret/admin-ui/ui/dialog"
import { RadioGroup, RadioGroupItem } from "@qticaret/admin-ui/ui/radio-group"
import { addonTemplatesQuery } from "@/features/products/api/addon-templates"
import type { AddonsFailure } from "@/features/products/detail/addon-failure"
import { AddonNotice } from "@/features/products/detail/addon-notice"
import { errorText } from "@/lib/errors"

const T = "products.addonTemplates"

interface AddonTemplatePickerProps {
  /** Templates the product reaches already: not offered again. */
  taken: readonly string[]
  /** How many more add-ons fit on the product (five in all). */
  room: number
  saving: boolean
  failure: AddonsFailure | null
  onClose: () => void
  onPick: (templateId: string) => void
}

/**
 * "Şablon ekle": one of the shop's add-on templates linked to the
 * product (adr/0052 Ek 2026-11-23). A template whose add-ons do not fit
 * in the five is shown, not offered. Templates are made under Settings.
 */
export function AddonTemplatePicker({
  taken,
  room,
  saving,
  failure,
  onClose,
  onPick,
}: AddonTemplatePickerProps) {
  const { t } = useTranslation()
  const templates = useQuery(addonTemplatesQuery())
  const [picked, setPicked] = useState("")
  const offered = (templates.data ?? []).filter((template) => !taken.includes(template.id))
  return (
    <DetailDialog
      open
      onOpenChange={(open) => {
        if (!open && !saving) {
          onClose()
        }
      }}
      title={t(`${T}.pickTitle`)}
      description={t(`${T}.pickDescription`)}
      footer={
        <>
          <Button type="button" variant="cancel" disabled={saving} onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            type="button"
            disabled={!picked || saving}
            onClick={() => {
              onPick(picked)
            }}
          >
            {saving ? <Loader2 className="animate-spin" /> : null}
            {t(`${T}.link`)}
          </Button>
        </>
      }
    >
      <DialogBody list>
        {templates.isError ? (
          <ErrorState
            text={errorText(t, templates.error)}
            onRetry={() => void templates.refetch()}
          />
        ) : templates.isPending ? (
          <LoadingRows rows={3} />
        ) : offered.length === 0 ? (
          <p className="rounded-md border border-dashed px-4 py-3 text-[13px] text-muted-foreground">
            {t(`${T}.noneToPick`)}{" "}
            <Link to="/settings/attributes" className="font-medium underline underline-offset-4">
              {t(`${T}.openSettings`)}
            </Link>
          </p>
        ) : (
          <RadioGroup
            aria-label={t(`${T}.pickTitle`)}
            value={picked}
            onValueChange={setPicked}
            className="flex flex-col gap-1"
          >
            {offered.map((template) => {
              const fits = template.addons.length <= room
              return (
                <label
                  key={template.id}
                  className="flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2.5 has-disabled:cursor-not-allowed has-disabled:opacity-60"
                >
                  <RadioGroupItem value={template.id} disabled={!fits} className="mt-0.5" />
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-sm font-medium">{template.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {fits
                        ? template.addons.map((addon) => addon.label).join(", ")
                        : t(`${T}.doesNotFit`, { count: template.addons.length })}
                    </span>
                  </span>
                </label>
              )
            })}
          </RadioGroup>
        )}
        {failure ? <AddonNotice tone="danger" {...failure} /> : null}
      </DialogBody>
    </DetailDialog>
  )
}
