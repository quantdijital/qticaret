import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { SearchPicker } from "@qticaret/admin-ui/patterns/search-picker"
import { customerQuery } from "@/features/customers/api/customers"
import { customerName } from "@/features/customers/names"
import type { ExtraOrderFilters } from "@/features/orders/components/order-filters"
import { sdk } from "@/lib/sdk"

const F = "orders.filters"

/** Customers by name or e-mail, for the filter's picker. */
const customerOptions = async (q: string) =>
  (
    await sdk.admin.customer.list({
      limit: 20,
      fields: "id,first_name,last_name,company_name,email",
      ...(q ? { q } : {}),
    })
  ).customers.map((customer) => ({
    id: customer.id,
    label: [customerName(customer), customer.email].filter(Boolean).join(" · "),
  }))

/**
 * One customer's orders (Woo's "Bu müşterinin siparişleri"): a filter in
 * the list's menu with a chip naming the customer, which the order's
 * customer card and the customer's page link to (`?customer=`).
 */
export function useCustomerFilter(
  value: string | undefined,
  onPick: (customer: string | undefined) => void
): ExtraOrderFilters {
  const { t } = useTranslation()
  const customer = useQuery({ ...customerQuery(value ?? ""), enabled: Boolean(value) })
  const name = customer.data
    ? (customerName(customer.data) ?? customer.data.email)
    : customer.isError
      ? t(`${F}.customerUnknown`)
      : "…"
  return {
    filters: [
      {
        key: "customer",
        label: t(`${F}.customer`),
        kind: "custom",
        summary: value ? name : undefined,
        render: (close) => (
          <SearchPicker
            label={t(`${F}.customer`)}
            value={value ? { id: value, label: name } : null}
            onChange={(next) => {
              onPick(next?.id)
              close()
            }}
            search={customerOptions}
            queryKey={["customers", "options"]}
            placeholder={t(`${F}.anyCustomer`)}
            empty={t(`${F}.noCustomer`)}
            className="sm:max-w-none"
          />
        ),
      },
    ],
    values: { customer: value },
    change: (_key, next) => ({ customer: typeof next === "string" ? next : undefined }),
    cleared: { customer: undefined },
  }
}
