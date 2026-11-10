import type { StaffMember } from "./api"

/** A member as the list names them: their name, else their address. */
export const memberName = (member: Pick<StaffMember, "first_name" | "last_name" | "email">) => {
  const name = [member.first_name, member.last_name].filter(Boolean).join(" ")
  return name !== "" ? name : member.email
}
