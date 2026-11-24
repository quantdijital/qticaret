import { useNavigate } from "@tanstack/react-router"
import { Loader2, Package, ShoppingBag, Truck, User } from "lucide-react"
import { useTranslation } from "react-i18next"
import { CommandGroup, CommandItem } from "@qticaret/admin-ui/ui/command"
import { SEARCH_MIN } from "@/features/search/api"
import { useRecordSearch } from "@/features/search/use-record-search"
import { formatMoney } from "@qticaret/admin-ui/lib/format"

const S = "command.search"

/**
 * What the command menu's search finds (F12.9): orders, customers,
 * products and parcels, above the pages. Each item's value starts with
 * what was typed, so the menu's own filter keeps what the server found.
 */
export function SearchResults({ search, onPick }: { search: string; onPick: () => void }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { typed, settled, query } = useRecordSearch(search)
  if (typed.length < SEARCH_MIN) {
    return null
  }
  const found = query.data
  const go = (action: () => Promise<void>) => {
    onPick()
    void action()
  }
  const valueOf = (kind: string, id: string) => `${typed} ${kind} ${id}`
  if (!found) {
    return query.isFetching || settled !== typed ? (
      <CommandGroup>
        <CommandItem value={valueOf("loading", "")} disabled>
          <Loader2 className="animate-spin" />
          {t(`${S}.searching`)}
        </CommandItem>
      </CommandGroup>
    ) : null
  }
  return (
    <>
      {found.orders.length > 0 ? (
        <CommandGroup heading={t(`${S}.orders`)}>
          {found.orders.map((order) => (
            <CommandItem
              key={order.id}
              value={valueOf("order", order.id)}
              onSelect={() => {
                go(() => navigate({ to: "/orders/$id", params: { id: order.id } }))
              }}
            >
              <ShoppingBag />
              <span className="font-medium tabular-nums">#{order.display_id}</span>
              <span className="min-w-0 flex-1 truncate text-muted-foreground">{order.name}</span>
              <span className="tabular-nums">{formatMoney(order.total, order.currency_code)}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      ) : null}
      {found.parcels.length > 0 ? (
        <CommandGroup heading={t(`${S}.parcels`)}>
          {found.parcels.map((parcel) => (
            <CommandItem
              key={`${parcel.order_id}-${parcel.tracking_number}`}
              value={valueOf("parcel", parcel.tracking_number)}
              onSelect={() => {
                go(() => navigate({ to: "/orders/$id", params: { id: parcel.order_id } }))
              }}
            >
              <Truck />
              <span className="font-mono">{parcel.tracking_number}</span>
              {parcel.display_id === null ? null : (
                <span className="text-muted-foreground">
                  {t(`${S}.parcelOf`, { number: parcel.display_id })}
                </span>
              )}
            </CommandItem>
          ))}
        </CommandGroup>
      ) : null}
      {found.customers.length > 0 ? (
        <CommandGroup heading={t(`${S}.customers`)}>
          {found.customers.map((customer) => (
            <CommandItem
              key={customer.id}
              value={valueOf("customer", customer.id)}
              onSelect={() => {
                go(() => navigate({ to: "/customers/$id", params: { id: customer.id } }))
              }}
            >
              <User />
              <span className="truncate">{customer.name ?? customer.email}</span>
              {customer.name ? (
                <span className="min-w-0 truncate text-muted-foreground">{customer.email}</span>
              ) : null}
            </CommandItem>
          ))}
        </CommandGroup>
      ) : null}
      {found.products.length > 0 ? (
        <CommandGroup heading={t(`${S}.products`)}>
          {found.products.map((product) => (
            <CommandItem
              key={product.id}
              value={valueOf("product", product.id)}
              onSelect={() => {
                go(() => navigate({ to: "/products/$id", params: { id: product.id } }))
              }}
            >
              <Package />
              <span className="truncate">{product.title}</span>
              {product.sku ? (
                <span className="font-mono text-xs text-muted-foreground">{product.sku}</span>
              ) : null}
            </CommandItem>
          ))}
        </CommandGroup>
      ) : null}
    </>
  )
}
