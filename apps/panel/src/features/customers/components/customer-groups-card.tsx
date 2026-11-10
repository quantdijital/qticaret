import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { StatusBadge } from "@qticaret/admin-ui/patterns/status-badge"
import { Skeleton } from "@qticaret/admin-ui/ui/skeleton"
import { Switch } from "@qticaret/admin-ui/ui/switch"
import {
  customerGroupIdsQuery,
  customerGroupsQuery,
  setCustomerGroup,
} from "@/features/customers/api/groups"
import { errorText } from "@/lib/errors"

const C = "customers.groupsCard"

/**
 * The groups a customer is in (F10.3): the shop's own ones switched on or
 * off here; a segment's are shown, filled by their rules.
 */
export function CustomerGroupsCard({ customerId }: { customerId: string }) {
  const { t } = useTranslation()
  const client = useQueryClient()
  const groups = useQuery(customerGroupsQuery())
  const memberOf = useQuery(customerGroupIdsQuery(customerId))
  const save = useMutation({
    mutationFn: ({ groupId, member }: { groupId: string; member: boolean }) =>
      setCustomerGroup(customerId, groupId, member),
    onSuccess: async () => {
      toast.success(t(`${C}.saved`))
      await client.invalidateQueries({ queryKey: ["customers", "groups", customerId] })
      await client.invalidateQueries({ queryKey: ["customer-groups"] })
    },
    onError: (failure) => {
      toast.error(errorText(t, failure))
    },
  })
  const ids = new Set(memberOf.data ?? [])
  const rows = groups.data ?? []
  return (
    <SectionCard title={t(`${C}.title`)} description={t(`${C}.description`)}>
      {!groups.data || !memberOf.data ? (
        <Skeleton className="h-16" />
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t(`${C}.empty`)}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((group) => {
            const id = `customer-group-${group.id}`
            return (
              <li key={group.id} className="flex items-center justify-between gap-3">
                <label htmlFor={id} className="flex min-w-0 items-center gap-2 text-sm">
                  <span className="truncate">{group.name}</span>
                  {group.segment ? (
                    <StatusBadge tone="neutral">{t(`${C}.segment`)}</StatusBadge>
                  ) : null}
                </label>
                <Switch
                  id={id}
                  checked={ids.has(group.id)}
                  // A segment's members follow its rules, not a hand
                  disabled={group.segment || save.isPending}
                  onCheckedChange={(member) => {
                    save.mutate({ groupId: group.id, member })
                  }}
                />
              </li>
            )
          })}
        </ul>
      )}
    </SectionCard>
  )
}
