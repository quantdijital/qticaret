import { useTranslation } from "react-i18next"
import { Avatar, AvatarFallback } from "@qticaret/admin-ui/ui/avatar"

const initials = (name: string | null) =>
  (name ?? "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.slice(0, 1).toLocaleUpperCase("tr"))
    .join("")

/** Who ordered and where it goes (il), with their initials. */
export function CustomerCell({
  customer,
}: {
  customer: { name: string | null; place: string | null }
}) {
  const { t } = useTranslation()
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <Avatar className="size-7">
        <AvatarFallback className="bg-muted text-[11px] font-medium">
          {initials(customer.name)}
        </AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-sm">{customer.name ?? t("orders.noName")}</span>
        {customer.place ? (
          <span className="truncate text-xs text-muted-foreground">{customer.place}</span>
        ) : null}
      </div>
    </div>
  )
}
