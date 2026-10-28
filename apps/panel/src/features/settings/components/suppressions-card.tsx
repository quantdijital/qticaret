import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Trash2 } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { SectionCard } from "@/components/patterns/section-card"
import { StatusBadge } from "@/components/patterns/status-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  addSuppression,
  removeSuppression,
  suppressionsQuery,
} from "@/features/settings/api/messaging"
import { errorText } from "@/lib/errors"
import { formatDate } from "@/lib/format"

const L = "settings.notifications.suppressions"

/**
 * Settings > Notifications: the addresses no message goes to (F9.6). A
 * hard bounce or a spam complaint Resend reports lands here by itself; the
 * shop can add an address a customer asked to leave alone, or take one
 * off once the mailbox works again.
 */
export function SuppressionsCard() {
  const { t } = useTranslation()
  const client = useQueryClient()
  const [offset, setOffset] = useState(0)
  const [address, setAddress] = useState("")
  const query = useQuery(suppressionsQuery(offset))
  const refresh = () => client.invalidateQueries({ queryKey: ["messaging", "suppressions"] })
  const add = useMutation({
    mutationFn: () => addSuppression({ channel: "email", address: address.trim() }),
    onSuccess: async () => {
      setAddress("")
      toast.success(t(`${L}.added`))
      await refresh()
    },
    onError: (failure) => {
      toast.error(errorText(t, failure))
    },
  })
  const remove = useMutation({
    mutationFn: removeSuppression,
    onSuccess: async () => {
      toast.success(t(`${L}.removed`))
      await refresh()
    },
    onError: (failure) => {
      toast.error(errorText(t, failure))
    },
  })
  const page = query.data
  return (
    <SectionCard title={t(`${L}.title`)} description={t(`${L}.description`)}>
      <form
        className="mb-4 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          if (address.trim() !== "") {
            add.mutate()
          }
        }}
      >
        <label htmlFor="suppression-address" className="sr-only">
          {t(`${L}.address`)}
        </label>
        <Input
          id="suppression-address"
          type="email"
          autoComplete="off"
          placeholder={t(`${L}.placeholder`)}
          value={address}
          onChange={(event) => {
            setAddress(event.target.value)
          }}
        />
        <Button type="submit" variant="outline" disabled={add.isPending || address.trim() === ""}>
          {t(`${L}.add`)}
        </Button>
      </form>
      {!page ? (
        <Skeleton className="h-16" />
      ) : page.suppressions.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t(`${L}.empty`)}</p>
      ) : (
        <ul className="flex flex-col divide-y rounded-md border">
          {page.suppressions.map((row) => (
            <li key={row.id} className="flex items-center gap-3 px-3 py-2.5">
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium">{row.recipient_masked}</span>
                <span className="text-xs text-muted-foreground">
                  {formatDate(row.created_at)}
                  {row.detail ? ` · ${row.detail}` : ""}
                </span>
              </span>
              <StatusBadge tone={row.reason === "manual" ? "neutral" : "warning"}>
                {t(`${L}.reasons.${row.reason}`)}
              </StatusBadge>
              <Button
                size="icon"
                variant="ghost"
                aria-label={t(`${L}.remove`, { address: row.recipient_masked })}
                disabled={remove.isPending}
                onClick={() => {
                  remove.mutate(row.id)
                }}
              >
                <Trash2 aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      {page && page.count > page.limit ? (
        <div className="mt-3 flex justify-end gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={offset === 0}
            onClick={() => {
              setOffset(Math.max(0, offset - page.limit))
            }}
          >
            {t("common.previous")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={offset + page.limit >= page.count}
            onClick={() => {
              setOffset(offset + page.limit)
            }}
          >
            {t("common.next")}
          </Button>
        </div>
      ) : null}
    </SectionCard>
  )
}
