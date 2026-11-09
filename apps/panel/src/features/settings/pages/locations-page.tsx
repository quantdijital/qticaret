import { useQuery } from "@tanstack/react-query"
import { MapPinOff, MoreHorizontal, Pencil, Plus, Star, Trash2, Warehouse } from "lucide-react"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { ConfirmDialog } from "@/components/patterns/confirm-dialog"
import { ErrorState, LoadingRows } from "@/components/patterns/states"
import { StatusBadge } from "@/components/patterns/status-badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  locationsQuery,
  useDeleteLocation,
  useSetDefaultLocation,
} from "@/features/settings/api/locations"
import type { Location } from "@/features/settings/api/locations"
import { LocationDialog } from "@/features/settings/components/location-dialog"
import { LowStockCard } from "@/features/settings/components/low-stock-card"
import { errorText } from "@/lib/errors"
import { formatPhone } from "@/lib/format"

function AddressLines({ location }: { location: Location }) {
  const { t } = useTranslation()
  const address = location.address
  if (!address?.address_1) {
    return (
      <p className="flex items-start gap-2 text-[13px] text-warning-text">
        <MapPinOff className="h-lh w-4 shrink-0" aria-hidden="true" />
        {t("settings.locations.noAddress")}
      </p>
    )
  }
  return (
    <address className="flex flex-col gap-0.5 text-[13px] leading-5 text-muted-foreground not-italic">
      <span className="text-foreground">
        {[address.address_2, address.address_1].filter(Boolean).join(", ")}
      </span>
      <span>{[address.postal_code, address.city, address.province].filter(Boolean).join(" ")}</span>
      {address.phone ? <span>{formatPhone(address.phone)}</span> : null}
    </address>
  )
}

function LocationCard({
  location,
  isDefault,
  onEdit,
  onMakeDefault,
  onDelete,
}: {
  location: Location
  isDefault: boolean
  onEdit: () => void
  onMakeDefault: () => void
  onDelete: () => void
}) {
  const { t } = useTranslation()
  return (
    // On a phone the actions take a row of their own under the address
    <li className="flex flex-wrap items-start gap-x-4 gap-y-3 rounded-lg border bg-card p-5 shadow-card">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted">
        <Warehouse className="size-5 text-muted-foreground" aria-hidden="true" />
      </span>
      <div className="flex min-w-0 flex-[1_1_12rem] flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate text-[15px] font-semibold">{location.name}</h3>
          {isDefault ? (
            <StatusBadge tone="info">{t("settings.locations.default")}</StatusBadge>
          ) : null}
        </div>
        <AddressLines location={location} />
      </div>
      <div className="ml-14 flex shrink-0 items-start gap-1 sm:ml-0">
        <Button variant="outline" size="sm" onClick={onEdit}>
          <Pencil />
          {t("common.edit")}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8" aria-label={t("common.more")}>
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem disabled={isDefault} onSelect={onMakeDefault}>
              <Star />
              {t("settings.locations.makeDefault")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" disabled={isDefault} onSelect={onDelete}>
              <Trash2 />
              {t("common.delete")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </li>
  )
}

/**
 * Warehouses (F3.7): where the shop keeps its stock. New products' stock
 * and the stock page use the default one; each sells to the shop's
 * channel, so checkout reserves from it. A warehouse that is the default
 * or still holds stock is kept (the server refuses). A tab of Settings >
 * Shipping and delivery (the owner, 2026-10-31), so no page header of its own.
 */
export function LocationsPanel() {
  const { t } = useTranslation()
  const list = useQuery(locationsQuery())
  const setDefault = useSetDefaultLocation()
  const remove = useDeleteLocation()
  const [editing, setEditing] = useState<Location | null | "new">(null)
  const [deleting, setDeleting] = useState<Location | null>(null)
  const data = list.data

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted-foreground">
          {t("settings.locations.description")}
        </p>
        <Button
          onClick={() => {
            setEditing("new")
          }}
          disabled={!data}
        >
          <Plus />
          {t("settings.locations.add")}
        </Button>
      </div>
      {list.error ? (
        <ErrorState text={errorText(t, list.error)} onRetry={() => void list.refetch()} />
      ) : !data ? (
        <LoadingRows />
      ) : (
        <ul className="grid gap-4 xl:grid-cols-2">
          {data.locations.map((location) => (
            <LocationCard
              key={location.id}
              location={location}
              isDefault={location.id === data.defaultId}
              onEdit={() => {
                setEditing(location)
              }}
              onMakeDefault={() => {
                setDefault.mutate(location.id, {
                  onSuccess: () => toast.success(t("settings.locations.defaultSet")),
                  onError: (failure) => toast.error(errorText(t, failure)),
                })
              }}
              onDelete={() => {
                setDeleting(location)
              }}
            />
          ))}
        </ul>
      )}
      <LowStockCard />
      <LocationDialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEditing(null)
          }
        }}
        location={editing === "new" ? null : editing}
      />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeleting(null)
          }
        }}
        title={t("settings.locations.deleteTitle", { name: deleting?.name ?? "" })}
        description={t("settings.locations.deleteDescription")}
        confirmLabel={t("common.delete")}
        destructive
        onConfirm={() => {
          if (!deleting) {
            return
          }
          remove.mutate(deleting.id, {
            onSuccess: () => toast.success(t("settings.locations.deleted")),
            onError: (failure) => toast.error(errorText(t, failure)),
          })
          setDeleting(null)
        }}
      />
    </div>
  )
}
