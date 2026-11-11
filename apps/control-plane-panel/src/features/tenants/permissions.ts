import type { StaffRole } from "@/features/auth/api"

/**
 * What a role may change on the shops and packages screens: the route
 * table's decisions (apps/control-plane `lib/staff/route-table.ts`), so a
 * button is not offered where the API would refuse. The API decides again.
 */
const has = (role: StaffRole | null | undefined, roles: readonly StaffRole[]) =>
  role ? roles.includes(role) : false

/** Records, contacts, domains, notes, a shop's package and exceptions. */
export const canManageShops = (role: StaffRole | null | undefined) =>
  has(role, ["owner", "operator"])

/** The company, the invoice's addressee, and its TCKN behind a step-up. */
export const canEditCompany = (role: StaffRole | null | undefined) =>
  has(role, ["owner", "operator", "finance"])

/** Packages: made, changed, priced and archived. */
export const canManagePackages = (role: StaffRole | null | undefined) =>
  has(role, ["owner", "finance"])
