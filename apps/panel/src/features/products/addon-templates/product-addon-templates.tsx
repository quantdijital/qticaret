import { Link } from "@tanstack/react-router"
import { LayoutTemplate, Unlink } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { Badge } from "@qticaret/admin-ui/ui/badge"
import { Button } from "@qticaret/admin-ui/ui/button"
import { useLinkAddonTemplates } from "@/features/products/api/addon-templates"
import type { ProductAddonTemplate } from "@/features/products/api/addon-templates"
import { addonsFailureOf } from "@/features/products/detail/addon-failure"
import type { AddonsFailure } from "@/features/products/detail/addon-failure"
import { AddonNotice } from "@/features/products/detail/addon-notice"
import { AddonRow } from "@/features/products/detail/addon-row"
import { valueOf } from "@/features/products/detail/addon-values"
import { AddonTemplatePicker } from "./addon-template-picker"

const T = "products.addonTemplates"
const noop = () => undefined

interface ProductAddonTemplatesProps {
  productId: string
  templates: readonly ProductAddonTemplate[]
  /** Add-ons that still fit on the product. */
  room: number
  /** Add-ons past five, not shown to shoppers. */
  hidden: number
  flagOn: boolean
}

/**
 * The add-on templates a product reaches, in the add-ons card (adr/0052
 * Ek 2026-11-23): each with its add-ons read-only (they change under
 * Settings, for every product at once), unlinked here when linked here;
 * one carried by the attribute template says so. "Şablon ekle" links
 * another.
 */
export function ProductAddonTemplates({
  productId,
  templates,
  room,
  hidden,
  flagOn,
}: ProductAddonTemplatesProps) {
  const { t } = useTranslation()
  const link = useLinkAddonTemplates(productId)
  const [picking, setPicking] = useState(false)
  const [failure, setFailure] = useState<AddonsFailure | null>(null)
  const linked = templates.filter((each) => each.via === "product").map((each) => each.id)

  const send = (ids: string[], done?: () => void) => {
    link.mutate(ids, {
      onSuccess: () => {
        setFailure(null)
        done?.()
        toast.success(t("products.detail.saved"))
      },
      onError: (error) => {
        setFailure(addonsFailureOf(t, error, flagOn))
      },
    })
  }

  return (
    <div className="flex flex-col gap-3">
      {templates.map((template) => (
        <section
          key={template.id}
          aria-label={template.name}
          className="flex flex-col overflow-hidden rounded-md border"
        >
          <header className="flex flex-wrap items-center gap-2 border-b bg-muted/40 px-3 py-2">
            <LayoutTemplate className="size-4 text-muted-foreground" aria-hidden="true" />
            <span className="text-sm font-medium">{template.name}</span>
            <Badge variant="outline">
              {t(template.via === "product" ? `${T}.viaProduct` : `${T}.viaAttribute`)}
            </Badge>
            <span className="ml-auto flex items-center gap-1">
              <Button asChild size="sm" variant="ghost">
                <Link to="/settings/attributes">{t(`${T}.editInSettings`)}</Link>
              </Button>
              {template.via === "product" ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={link.isPending}
                  onClick={() => {
                    send(linked.filter((id) => id !== template.id))
                  }}
                >
                  <Unlink />
                  {t(`${T}.unlink`)}
                </Button>
              ) : null}
            </span>
          </header>
          <ol className="flex flex-col divide-y">
            {template.addons.map((addon, index) => (
              <AddonRow
                key={addon.id}
                value={valueOf(addon)}
                index={index}
                count={template.addons.length}
                readOnly
                onMove={noop}
                onEdit={noop}
                onRemove={noop}
              />
            ))}
          </ol>
        </section>
      ))}
      {flagOn ? (
        <div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={room <= 0}
            onClick={() => {
              setFailure(null)
              setPicking(true)
            }}
          >
            <LayoutTemplate />
            {t(`${T}.add`)}
          </Button>
        </div>
      ) : null}
      {hidden > 0 ? (
        <AddonNotice tone="warning" text={t(`${T}.hidden`, { count: hidden })} features={false} />
      ) : null}
      {failure && !picking ? <AddonNotice tone="danger" {...failure} /> : null}
      {picking ? (
        <AddonTemplatePicker
          taken={templates.map((each) => each.id)}
          room={room}
          saving={link.isPending}
          failure={failure}
          onClose={() => {
            setPicking(false)
          }}
          onPick={(id) => {
            send([...linked, id], () => {
              setPicking(false)
            })
          }}
        />
      ) : null}
    </div>
  )
}
