import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/patterns/confirm-dialog"
import { SectionCard } from "@/components/patterns/section-card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  customerSegmentsQuery,
  deleteCustomerSegment,
  refreshCustomerSegment,
} from "@/features/customers/api/groups"
import type { CustomerSegment } from "@/features/customers/api/groups"
import { SegmentDialog } from "@/features/customers/components/segment-dialog"
import { rulesText } from "@/features/customers/segment-form"
import { errorText } from "@/lib/errors"
import { formatDate } from "@/lib/format"

const S = "customers.segments"

/**
 * The shop's segments (F10.3, adr/0037 §6): their rules, how many
 * customers they hold and when they were last filled; made, changed,
 * filled now or removed here.
 */
export function SegmentsCard() {
  const { t } = useTranslation()
  const client = useQueryClient()
  const query = useQuery(customerSegmentsQuery())
  // null: closed; "new": a new one; a segment: that one
  const [editing, setEditing] = useState<CustomerSegment | "new" | null>(null)
  const [removing, setRemoving] = useState<CustomerSegment | null>(null)
  const refreshAll = async () => {
    await client.invalidateQueries({ queryKey: ["customer-segments"] })
    await client.invalidateQueries({ queryKey: ["customer-groups"] })
  }
  const refresh = useMutation({
    mutationFn: refreshCustomerSegment,
    onSuccess: async ({ member_count: count }) => {
      toast.success(t(`${S}.refreshed`, { count }))
      await refreshAll()
    },
    onError: (failure) => toast.error(errorText(t, failure)),
  })
  const remove = useMutation({
    mutationFn: deleteCustomerSegment,
    onSuccess: async () => {
      toast.success(t(`${S}.deleted`))
      setRemoving(null)
      await refreshAll()
    },
    onError: (failure) => toast.error(errorText(t, failure)),
  })
  return (
    <SectionCard
      title={t(`${S}.title`)}
      description={t(`${S}.description`)}
      action={
        <Button
          size="sm"
          onClick={() => {
            setEditing("new")
          }}
        >
          {t(`${S}.new`)}
        </Button>
      }
    >
      {!query.data ? (
        <Skeleton className="h-24" />
      ) : query.data.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t(`${S}.empty`)}</p>
      ) : (
        <ul className="flex flex-col divide-y">
          {query.data.map((segment) => (
            <li key={segment.id} className="flex flex-wrap items-center gap-3 py-3">
              <div className="flex min-w-0 flex-[1_1_16rem] flex-col gap-0.5">
                <span className="text-sm font-medium">{segment.name}</span>
                <span className="text-[13px] text-muted-foreground">
                  {rulesText(t, segment.rules)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {t(`${S}.members`, { count: segment.member_count })} ·{" "}
                  {segment.refreshed_at
                    ? t(`${S}.refreshedAt`, { date: formatDate(segment.refreshed_at) })
                    : t(`${S}.neverRefreshed`)}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={refresh.isPending}
                  onClick={() => {
                    refresh.mutate(segment.id)
                  }}
                >
                  {t(`${S}.refresh`)}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditing(segment)
                  }}
                >
                  {t(`${S}.edit`)}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setRemoving(segment)
                  }}
                >
                  {t(`${S}.delete`)}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {editing ? (
        <SegmentDialog
          key={editing === "new" ? "new" : editing.id}
          open
          segment={editing === "new" ? null : editing}
          onClose={() => {
            setEditing(null)
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
        title={t(`${S}.deleteTitle`, { name: removing?.name ?? "" })}
        description={t(`${S}.deleteDescription`)}
        confirmLabel={t(`${S}.delete`)}
        destructive
        onConfirm={() => {
          if (removing) {
            remove.mutate(removing.id)
          }
        }}
      />
    </SectionCard>
  )
}
