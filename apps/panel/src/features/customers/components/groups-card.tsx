import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { ConfirmDialog } from "@qticaret/admin-ui/patterns/confirm-dialog"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { Button } from "@qticaret/admin-ui/ui/button"
import { Input } from "@qticaret/admin-ui/ui/input"
import { Skeleton } from "@qticaret/admin-ui/ui/skeleton"
import {
  createCustomerGroup,
  customerGroupsQuery,
  deleteCustomerGroup,
  renameCustomerGroup,
} from "@/features/customers/api/groups"
import type { CustomerGroupRow } from "@/features/customers/api/groups"
import { errorText } from "@/lib/errors"

const G = "customers.groups"

/**
 * The groups the shop manages by hand (F10.3): made, renamed or removed
 * here; who is in them is set on each customer's page. A segment's group
 * is listed with its segment.
 */
export function GroupsCard() {
  const { t } = useTranslation()
  const client = useQueryClient()
  const query = useQuery(customerGroupsQuery())
  const [name, setName] = useState("")
  // The group being renamed and its name as typed
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null)
  const [removing, setRemoving] = useState<CustomerGroupRow | null>(null)
  const done = (message: string) => async () => {
    toast.success(t(message))
    setName("")
    setRenaming(null)
    setRemoving(null)
    await client.invalidateQueries({ queryKey: ["customer-groups"] })
  }
  const failed = (failure: unknown) => {
    toast.error(errorText(t, failure))
  }
  const create = useMutation({
    mutationFn: createCustomerGroup,
    onSuccess: done(`${G}.saved`),
    onError: failed,
  })
  const rename = useMutation({
    mutationFn: (group: { id: string; name: string }) => renameCustomerGroup(group.id, group.name),
    onSuccess: done(`${G}.saved`),
    onError: failed,
  })
  const remove = useMutation({
    mutationFn: deleteCustomerGroup,
    onSuccess: done(`${G}.deleted`),
    onError: failed,
  })
  const groups = (query.data ?? []).filter((group) => !group.segment)
  return (
    <SectionCard title={t(`${G}.title`)} description={t(`${G}.description`)}>
      <form
        className="mb-4 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          if (name.trim() !== "") {
            create.mutate(name.trim())
          }
        }}
      >
        <label htmlFor="group-name" className="sr-only">
          {t(`${G}.name`)}
        </label>
        <Input
          id="group-name"
          maxLength={100}
          placeholder={t(`${G}.new`)}
          value={name}
          onChange={(event) => {
            setName(event.target.value)
          }}
        />
        <Button type="submit" variant="outline" disabled={create.isPending || name.trim() === ""}>
          {t(`${G}.add`)}
        </Button>
      </form>
      {!query.data ? (
        <Skeleton className="h-16" />
      ) : groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t(`${G}.empty`)}</p>
      ) : (
        <ul className="flex flex-col divide-y">
          {groups.map((group) => (
            <li key={group.id} className="flex flex-wrap items-center gap-3 py-3">
              {renaming?.id === group.id ? (
                <form
                  className="flex flex-[1_1_16rem] gap-2"
                  onSubmit={(event) => {
                    event.preventDefault()
                    if (renaming.name.trim() !== "") {
                      rename.mutate({ id: group.id, name: renaming.name.trim() })
                    }
                  }}
                >
                  <label htmlFor={`rename-${group.id}`} className="sr-only">
                    {t(`${G}.renameTitle`)}
                  </label>
                  <Input
                    id={`rename-${group.id}`}
                    autoFocus
                    maxLength={100}
                    value={renaming.name}
                    onChange={(event) => {
                      setRenaming({ id: group.id, name: event.target.value })
                    }}
                  />
                  <Button type="submit" size="sm" disabled={rename.isPending}>
                    {t("customers.segments.save")}
                  </Button>
                </form>
              ) : (
                <div className="flex min-w-0 flex-[1_1_16rem] flex-col gap-0.5">
                  <span className="text-sm font-medium">{group.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {t("customers.segments.members", { count: group.members })}
                  </span>
                </div>
              )}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setRenaming({ id: group.id, name: group.name })
                  }}
                >
                  {t(`${G}.rename`)}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setRemoving(group)
                  }}
                >
                  {t(`${G}.delete`)}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRemoving(null)
          }
        }}
        title={t(`${G}.deleteTitle`, { name: removing?.name ?? "" })}
        description={t(`${G}.deleteDescription`)}
        confirmLabel={t(`${G}.delete`)}
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
