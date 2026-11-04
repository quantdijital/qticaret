import { useQuery } from "@tanstack/react-query"
import { Plus } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/patterns/confirm-dialog"
import { SectionCard } from "@/components/patterns/section-card"
import { ErrorState, LoadingRows } from "@/components/patterns/states"
import { StatusBadge } from "@/components/patterns/status-badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useCan } from "@/features/auth/api/staff"
import {
  percentText,
  useSetDefaultVatRate,
  useUpdateVatRate,
  vatRatesQuery,
} from "@/features/settings/api/vat-rates"
import type { VatRate } from "@/features/settings/api/vat-rates"
import { VatRateDialog } from "@/features/settings/components/vat-rate-dialog"
import { VatRateMenu } from "@/features/settings/components/vat-rate-menu"
import { errorText } from "@/lib/errors"
import { formatCount } from "@/lib/format"
import { cn } from "@/lib/utils"

const V = "settings.vatRates"

/**
 * Settings > Invoices and accounting > KDV rates (adr/0007 Ek 2026-11-04,
 * the owner: "bence ekleyelim onu"): the shop's rates, how many products
 * each taxes and which is the default; the owner adds, renames, removes
 * and brings back rates and moves the default, the others read.
 */
export function VatRatesCard() {
  const { t } = useTranslation()
  const can = useCan("vatRates")
  const list = useQuery(vatRatesQuery())
  const update = useUpdateVatRate()
  const setDefault = useSetDefaultVatRate()
  const [editing, setEditing] = useState<VatRate | "new" | null>(null)
  const [removing, setRemoving] = useState<VatRate | null>(null)
  const [defaulting, setDefaulting] = useState<VatRate | null>(null)
  const data = list.data
  const fail = (failure: unknown) => toast.error(errorText(t, failure))

  const change = (rate: VatRate, body: { active: boolean }, done: string) => {
    update.mutate(
      { id: rate.id, ...body },
      { onSuccess: () => toast.success(t(done, { name: rate.name })), onError: fail }
    )
  }

  return (
    <SectionCard
      title={t(`${V}.title`)}
      description={t(`${V}.description`)}
      action={
        can ? (
          <Button
            size="sm"
            disabled={!data}
            onClick={() => {
              setEditing("new")
            }}
          >
            <Plus />
            {t(`${V}.add`)}
          </Button>
        ) : null
      }
      flush
    >
      <p className="px-5 pb-4 text-[13px] leading-5 text-muted-foreground">
        {t(`${V}.howItWorks`)} {can ? null : t(`${V}.readOnly`)}
      </p>
      {list.error ? (
        <div className="px-5 pb-5">
          <ErrorState text={errorText(t, list.error)} onRetry={() => void list.refetch()} />
        </div>
      ) : !data ? (
        <div className="px-5 pb-5">
          <LoadingRows />
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-5">{t(`${V}.columns.name`)}</TableHead>
              <TableHead className="text-right">{t(`${V}.columns.rate`)}</TableHead>
              <TableHead className={cn("text-right", can ? "" : "pr-5")}>
                {t(`${V}.columns.products`)}
              </TableHead>
              {can ? (
                <TableHead className="w-12 pr-5">
                  <span className="sr-only">{t(`${V}.columns.actions`)}</span>
                </TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.rates.map((rate) => {
              const isDefault = rate.id === data.default?.id
              return (
                <TableRow key={rate.id} className={rate.active ? "" : "text-muted-foreground"}>
                  <TableCell className="pl-5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{rate.name}</span>
                      {isDefault ? (
                        <StatusBadge tone="info">{t(`${V}.default`)}</StatusBadge>
                      ) : null}
                      {rate.active ? null : (
                        <StatusBadge tone="neutral">{t(`${V}.removed`)}</StatusBadge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    %{percentText(rate.rate)}
                  </TableCell>
                  <TableCell className={cn("text-right tabular-nums", can ? "" : "pr-5")}>
                    {rate.active ? formatCount(rate.products) : "—"}
                  </TableCell>
                  {can ? (
                    <TableCell className="pr-5 text-right">
                      <VatRateMenu
                        rate={rate}
                        isDefault={isDefault}
                        onRename={() => {
                          setEditing(rate)
                        }}
                        onMakeDefault={() => {
                          setDefaulting(rate)
                        }}
                        onRemove={() => {
                          setRemoving(rate)
                        }}
                        onRestore={() => {
                          change(rate, { active: true }, `${V}.restored`)
                        }}
                      />
                    </TableCell>
                  ) : null}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}
      {editing === null ? null : (
        <VatRateDialog
          rate={editing === "new" ? null : editing}
          onClose={() => {
            setEditing(null)
          }}
        />
      )}
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRemoving(null)
          }
        }}
        title={t(`${V}.removeTitle`, { name: removing?.name ?? "" })}
        description={t(`${V}.removeDescription`)}
        confirmLabel={t(`${V}.removeConfirm`)}
        destructive
        onConfirm={() => {
          if (removing) {
            change(removing, { active: false }, `${V}.removedDone`)
          }
          setRemoving(null)
        }}
      />
      <ConfirmDialog
        open={defaulting !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDefaulting(null)
          }
        }}
        title={t(`${V}.defaultTitle`, { name: defaulting?.name ?? "" })}
        description={t(`${V}.defaultDescription`, {
          name: defaulting?.name ?? "",
          current: data?.default?.name ?? "",
        })}
        confirmLabel={t(`${V}.makeDefault`)}
        onConfirm={() => {
          const rate = defaulting
          if (rate) {
            setDefault.mutate(rate.id, {
              onSuccess: () => toast.success(t(`${V}.defaultSet`, { name: rate.name })),
              onError: fail,
            })
          }
          setDefaulting(null)
        }}
      />
    </SectionCard>
  )
}
