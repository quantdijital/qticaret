import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useStaff } from "@/features/auth/api/staff"
import { teamQuery } from "@/features/settings/api/team"

const F = "paymentLinks.filters"
const ANY = "__any"

export type DiscountView = "true" | "false" | undefined

/**
 * "İndirimli bağlantılar" (adr/0051 §10): the discount and who made the
 * link, beside the state tabs; one row of equal controls. The owner sees
 * here what discounts the staff gave.
 */
export function LinkFilters({
  discounted,
  createdBy,
  onChange,
}: {
  discounted: DiscountView
  createdBy: string | undefined
  onChange: (next: { discounted?: DiscountView; created_by?: string | undefined }) => void
}) {
  const { t } = useTranslation()
  const staff = useStaff()
  const team = useQuery({ ...teamQuery(), enabled: staff?.can.team === true })
  const others = (team.data?.staff ?? []).filter((member) => member.id !== staff?.user_id)
  // Someone no longer on the team, or a team that cannot be read: still chosen, by id
  const unknown =
    createdBy !== undefined &&
    createdBy !== staff?.user_id &&
    !others.some((member) => member.id === createdBy)
  return (
    <div className="flex flex-wrap items-center gap-2 px-3 py-2 sm:py-0">
      <Select
        value={discounted ?? ANY}
        onValueChange={(next) => {
          onChange({ discounted: next === ANY ? undefined : (next as DiscountView) })
        }}
      >
        <SelectTrigger size="sm" className="w-full sm:w-44" aria-label={t(`${F}.discount`)}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>{t(`${F}.anyDiscount`)}</SelectItem>
          <SelectItem value="true">{t(`${F}.discounted`)}</SelectItem>
          <SelectItem value="false">{t(`${F}.notDiscounted`)}</SelectItem>
        </SelectContent>
      </Select>
      <Select
        value={createdBy ?? ANY}
        onValueChange={(next) => {
          onChange({ created_by: next === ANY ? undefined : next })
        }}
      >
        <SelectTrigger size="sm" className="w-full sm:w-44" aria-label={t(`${F}.createdBy`)}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>{t(`${F}.anyone`)}</SelectItem>
          {staff ? <SelectItem value={staff.user_id}>{t(`${F}.mine`)}</SelectItem> : null}
          {others.length > 0 || unknown ? (
            <SelectGroup>
              <SelectLabel>{t(`${F}.team`)}</SelectLabel>
              {others.map((member) => (
                <SelectItem key={member.id} value={member.id}>
                  {[member.first_name, member.last_name].filter(Boolean).join(" ") || member.email}
                </SelectItem>
              ))}
              {unknown ? (
                <SelectItem value={createdBy}>{t("paymentLinks.teamMember")}</SelectItem>
              ) : null}
            </SelectGroup>
          ) : null}
        </SelectContent>
      </Select>
    </div>
  )
}
