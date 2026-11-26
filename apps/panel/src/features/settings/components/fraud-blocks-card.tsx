import { useQuery } from "@tanstack/react-query"
import { Loader2, Trash2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { ErrorState } from "@qticaret/admin-ui/patterns/states"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Input } from "@qticaret/admin-ui/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@qticaret/admin-ui/ui/select"
import { Skeleton } from "@qticaret/admin-ui/ui/skeleton"
import {
  FRAUD_BLOCK_KINDS,
  fraudBlocksQuery,
  useAddBlock,
  useRemoveBlock,
} from "@/features/settings/api/fraud"
import type { FraudBlock, FraudBlockKind } from "@/features/settings/api/fraud"
import { errorText } from "@/lib/errors"
import { formatDate } from "@qticaret/admin-ui/lib/format"

const C = "settings.security.blocks"

function Row({ block }: { block: FraudBlock }) {
  const { t } = useTranslation()
  const remove = useRemoveBlock()
  return (
    <li className="flex items-center justify-between gap-3 px-5 py-2.5">
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-medium">{block.display}</span>
        <span className="truncate text-xs text-muted-foreground">
          {[block.reason, formatDate(block.created_at)].filter(Boolean).join(" · ")}
        </span>
      </span>
      <Button
        size="icon"
        variant="ghost"
        aria-label={t(`${C}.remove`, { value: block.display })}
        disabled={remove.isPending}
        onClick={() => {
          remove.mutate(block.id, {
            onSuccess: () => toast.success(t(`${C}.removed`)),
            onError: (failure) => toast.error(errorText(t, failure)),
          })
        }}
      >
        <Trash2 />
      </Button>
    </li>
  )
}

/**
 * The shop's block list (F15.6, adr/0044 §4): an e-mail, a domain, a phone
 * or an IP address that may not register, sign in or check out. Grouped by
 * kind; an e-mail or a phone shown masked, as the server keeps only its hash.
 */
export function FraudBlocksCard({ className }: { className?: string }) {
  const { t } = useTranslation()
  const blocks = useQuery(fraudBlocksQuery())
  const add = useAddBlock()
  const [kind, setKind] = useState<FraudBlockKind>("email")
  const [value, setValue] = useState("")
  const [reason, setReason] = useState("")
  const rows = blocks.data?.blocks ?? []
  return (
    <SectionCard title={t(`${C}.title`)} description={t(`${C}.hint`)} className={className} flush>
      <form
        className="flex flex-wrap items-end gap-3 border-b px-5 pb-4"
        onSubmit={(event) => {
          event.preventDefault()
          add.mutate(
            { kind, value: value.trim(), ...(reason.trim() ? { reason: reason.trim() } : {}) },
            {
              onSuccess: () => {
                setValue("")
                setReason("")
                toast.success(t(`${C}.added`))
              },
              onError: (failure) => toast.error(errorText(t, failure)),
            }
          )
        }}
      >
        <div className="flex w-full flex-col gap-2 sm:w-auto">
          <span id="fraud-block-kind" className="text-sm font-medium">
            {t(`${C}.kind`)}
          </span>
          <Select
            value={kind}
            onValueChange={(next) => {
              setKind(next as FraudBlockKind)
            }}
          >
            <SelectTrigger className="w-full sm:w-44" aria-labelledby="fraud-block-kind">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FRAUD_BLOCK_KINDS.map((one) => (
                <SelectItem key={one} value={one}>
                  {t(`${C}.kinds.${one}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex min-w-48 flex-1 flex-col gap-2">
          <label htmlFor="fraud-block-value" className="text-sm font-medium">
            {t(`${C}.value`)}
          </label>
          <Input
            id="fraud-block-value"
            value={value}
            placeholder={t(`${C}.placeholders.${kind}`)}
            onChange={(event) => {
              setValue(event.target.value)
            }}
          />
        </div>
        <div className="flex min-w-48 flex-1 flex-col gap-2">
          <label htmlFor="fraud-block-reason" className="text-sm font-medium">
            {t(`${C}.reason`)}
          </label>
          <Input
            placeholder={t("settings.placeholders.blockReason")}
            id="fraud-block-reason"
            value={reason}
            maxLength={500}
            onChange={(event) => {
              setReason(event.target.value)
            }}
          />
        </div>
        <Button type="submit" disabled={value.trim() === "" || add.isPending}>
          {add.isPending ? <Loader2 className="animate-spin" /> : null}
          {t(`${C}.add`)}
        </Button>
      </form>
      {blocks.isError ? (
        <div className="p-5">
          <ErrorState text={errorText(t, blocks.error)} onRetry={() => void blocks.refetch()} />
        </div>
      ) : !blocks.data ? (
        <div className="p-5">
          <Skeleton className="h-16" />
        </div>
      ) : rows.length === 0 ? (
        <p className="px-5 py-4 text-sm text-muted-foreground">{t(`${C}.empty`)}</p>
      ) : (
        FRAUD_BLOCK_KINDS.filter((one) => rows.some((row) => row.kind === one)).map((one) => (
          <div key={one} className="border-b last:border-b-0">
            <h3 className="px-5 pt-3 text-xs font-medium text-muted-foreground uppercase">
              {t(`${C}.kinds.${one}`)}
            </h3>
            <ul className="divide-y">
              {rows
                .filter((row) => row.kind === one)
                .map((row) => (
                  <Row key={row.id} block={row} />
                ))}
            </ul>
          </div>
        ))
      )}
    </SectionCard>
  )
}
