import { useQuery } from "@tanstack/react-query"
import { Pencil, Plus, Trash2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/patterns/confirm-dialog"
import { SectionCard } from "@/components/patterns/section-card"
import { ErrorState, LoadingRows } from "@/components/patterns/states"
import { Button } from "@/components/ui/button"
import {
  shopShippingOptionsQuery,
  useDeleteShippingOption,
} from "@/features/settings/api/shipping-options"
import type { ShopShippingOption } from "@/features/settings/api/shipping-options"
import { ShippingOptionDialog } from "@/features/settings/components/shipping-option-dialog"
import { errorText } from "@/lib/errors"
import { formatMoney } from "@/lib/format"

const S = "settings.shipping.options"

/** How shoppers pay for it, in a few words: the amount, or where the price comes from. */
function priceText(t: (key: string) => string, option: ShopShippingOption): string {
  if (option.pricing === "flat") {
    return Number(option.amount ?? 0) === 0
      ? t(`${S}.free`)
      : formatMoney(option.amount ?? "0", "try")
  }
  return t(`${S}.pricings.${option.pricing}`)
}

/**
 * Settings > Shipping > the options shoppers choose from at checkout
 * (F7.8): who carries each, how it is priced; added, renamed, removed.
 */
export function ShippingOptionsCard() {
  const { t } = useTranslation()
  const query = useQuery(shopShippingOptionsQuery())
  const remove = useDeleteShippingOption()
  const [editing, setEditing] = useState<ShopShippingOption | "new" | null>(null)
  const [removing, setRemoving] = useState<ShopShippingOption | null>(null)
  return (
    <SectionCard
      title={t(`${S}.title`)}
      description={t(`${S}.description`)}
      flush
      action={
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setEditing("new")
          }}
        >
          <Plus />
          {t(`${S}.add`)}
        </Button>
      }
    >
      {query.isError ? (
        <div className="px-5 pb-5">
          <ErrorState text={errorText(t, query.error)} onRetry={() => void query.refetch()} />
        </div>
      ) : !query.data ? (
        <LoadingRows rows={2} />
      ) : query.data.length === 0 ? (
        <p className="border-t px-5 py-4 text-[13px] text-muted-foreground">{t(`${S}.none`)}</p>
      ) : (
        <ul>
          {query.data.map((option) => (
            <li
              key={option.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t px-5 py-3.5"
            >
              <div className="flex min-w-0 flex-[1_1_14rem] flex-col gap-0.5">
                <span className="text-sm font-medium">{option.name}</span>
                <span className="text-[13px] text-muted-foreground">
                  {t(`${S}.carriers.${option.carrier ?? "manual"}`)}
                </span>
              </div>
              <span className="text-sm tabular-nums">{priceText(t, option)}</span>
              <span className="flex gap-1">
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={t(`${S}.edit`, { name: option.name })}
                  onClick={() => {
                    setEditing(option)
                  }}
                >
                  <Pencil />
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={t(`${S}.remove`, { name: option.name })}
                  onClick={() => {
                    setRemoving(option)
                  }}
                >
                  <Trash2 />
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {editing ? (
        <ShippingOptionDialog
          key={editing === "new" ? "new" : editing.id}
          option={editing === "new" ? undefined : editing}
          open
          onOpenChange={(open) => {
            if (!open) {
              setEditing(null)
            }
          }}
        />
      ) : null}
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRemoving(null)
          }
        }}
        title={t(`${S}.removeTitle`, { name: removing?.name ?? "" })}
        description={t(`${S}.removeDescription`)}
        confirmLabel={t(`${S}.removeConfirm`)}
        destructive
        onConfirm={() => {
          if (removing) {
            remove.mutate(removing.id, {
              onSuccess: () => toast.success(t(`${S}.removed`)),
              onError: (failure) => toast.error(errorText(t, failure)),
            })
          }
        }}
      />
    </SectionCard>
  )
}
