import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { useStaff } from "@/features/auth/api/staff"
import { teamQuery } from "@/features/settings/api/team"

/**
 * Who made a link, by name: "Siz" for oneself, the member's name where the
 * team can be read (owner and admin), "Ekip üyesi" otherwise; the API
 * gives only a user id.
 */
export function useCreatorName(): (userId: string) => string {
  const { t } = useTranslation()
  const staff = useStaff()
  const team = useQuery({ ...teamQuery(), enabled: staff?.can.team === true })
  return (userId) => {
    if (userId === staff?.user_id) {
      return t("paymentLinks.you")
    }
    const member = team.data?.staff.find((each) => each.id === userId)
    if (!member) {
      return t("paymentLinks.teamMember")
    }
    return [member.first_name, member.last_name].filter(Boolean).join(" ") || member.email
  }
}
