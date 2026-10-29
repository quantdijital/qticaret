import { moduleIntegrationTestRunner } from "@medusajs/test-utils"
import { STAFF_ROLES_MODULE } from ".."
import type StaffRolesModuleService from "../service"

jest.setTimeout(120 * 1000)

moduleIntegrationTestRunner<StaffRolesModuleService>({
  moduleName: STAFF_ROLES_MODULE,
  resolve: "./src/modules/staff-roles",
  testSuite: ({ service }) => {
    it("makes the first user of a shop without staff its owner, and gives no one else a role", async () => {
      const [first, second] = await Promise.all([
        service.roleOf("user_first"),
        service.roleOf("user_second"),
      ])

      // The other reaches nothing until given a role
      expect([first, second]).toEqual(expect.arrayContaining(["owner", null]))
      expect(await service.listStaffRoles({}, { select: ["role"] })).toEqual([
        expect.objectContaining({ role: "owner" }),
      ])
      expect(await service.roleOf("user_third")).toBeNull()
    })

    it("gives a role at once, and changes it", async () => {
      await service.setRole("user_owner", "owner", null)
      await service.setRole("user_ops", "operations", "user_owner")
      expect(await service.roleOf("user_ops")).toBe("operations")

      await service.setRole("user_ops", "admin", "user_owner")

      expect(await service.roleOf("user_ops")).toBe("admin")
      expect(await service.listStaffRoles({ user_id: "user_ops" })).toEqual([
        expect.objectContaining({ role: "admin", assigned_by: "user_owner" }),
      ])
    })

    it("never leaves the shop without an owner, two changes at once included", async () => {
      await service.setRole("user_a", "owner", null)

      await expect(service.setRole("user_a", "admin", null)).rejects.toThrow("staff.last_owner")
      await expect(service.removeRole("user_a")).rejects.toThrow("staff.last_owner")

      await service.setRole("user_b", "owner", "user_a")
      const outcomes = await Promise.allSettled([
        service.setRole("user_a", "admin", "user_b"),
        service.setRole("user_b", "admin", "user_a"),
      ])
      const owners = await service.listStaffRoles({ role: "owner" })

      expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1)
      expect(owners).toHaveLength(1)
    })

    it("takes a leaver's role away", async () => {
      await service.setRole("user_owner", "owner", null)
      await service.setRole("user_gone", "admin", "user_owner")

      await service.removeRole("user_gone")

      expect(await service.roleOf("user_gone")).toBeNull()
    })
  },
})
