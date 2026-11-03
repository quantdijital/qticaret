import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { useStaff } from "@/features/auth/api/staff"
import { teamQuery } from "@/features/settings/api/team"

/**
 * Who made (or cancelled) a link, by name: "Siz" for oneself, the name the
 * backend sends beside the user id (`created_by_name`, `canceled_by_name`)
 * when it does, else the member's name where the team can be read (owner
 * and admin), "Ekip üyesi" otherwise.
 */
export function useCreatorName(): (userId: string, name?: string | null) => string {
  const { t } = useTranslation()
  const staff = useStaff()
  const team = useQuery({ ...teamQuery(), enabled: staff?.can.team === true })
  return (userId, name) => {
    if (userId === staff?.user_id) {
      return t("paymentLinks.you")
    }
    const sent = name?.trim() ?? ""
    if (sent !== "") {
      return sent
    }
    const member = team.data?.staff.find((each) => each.id === userId)
    if (!member) {
      return t("paymentLinks.teamMember")
    }
    return [member.first_name, member.last_name].filter(Boolean).join(" ") || member.email
  }
}
