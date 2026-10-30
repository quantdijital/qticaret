import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { STAFF_ROLES_MODULE } from "../../src/modules/staff-roles"
import type StaffRolesModuleService from "../../src/modules/staff-roles/service"
import staffRolesInitial from "../../src/migration-scripts/staff-roles-initial"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"

jest.setTimeout(120 * 1000)

interface Me {
  role: string
  can: Record<string, boolean>
}

/** F12.6 (adr/0040; KK1): each staff member reaches what their role allows, at once. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    const roles = () => getContainer().resolve<StaffRolesModuleService>(STAFF_ROLES_MODULE)
    const as = (headers: Record<string, string>) => ({
      get: (url: string) => settle(http.get<Record<string, unknown>>(url, { headers })),
      post: (url: string, body: unknown = {}) =>
        settle(http.post<Record<string, unknown>>(url, body, { headers })),
    })

    it("keeps operations from the shop's settings, and lets them work the orders (KK1)", async () => {
      await createAdminUser(http, getContainer())
      const ops = as((await createAdminUser(http, getContainer(), "operations")).headers)

      const me = await ops.get("/admin/staff/me")
      const orders = await ops.get("/admin/orders?limit=5")
      const settings = await ops.post("/admin/platform-settings/store", {
        timezone: "Europe/Istanbul",
      })
      const product = await ops.post("/admin/products", { title: "Kupa" })
      const audit = await ops.get("/admin/audit-log")
      const staff = await ops.get("/admin/users")
      const self = await ops.get("/admin/users/me")

      expect(me.data).toMatchObject({
        role: "operations",
        can: { orders: true, stock: true, settings: false, money: false, staff: false },
      } satisfies Partial<Me>)
      expect(orders.status).toBe(200)
      expect([settings.status, product.status, audit.status, staff.status]).toEqual([
        403, 403, 403, 403,
      ])
      expect(settings.data).toMatchObject({ message: "staff.forbidden" })
      expect(self.status).toBe(200)
    })

    it("shows the others the team's feed alone, not the messages customers were sent", async () => {
      const ops = as((await createAdminUser(http, getContainer(), "operations")).headers)
      const admin = as((await createAdminUser(http, getContainer(), "admin")).headers)

      const feed = await ops.get("/admin/notifications?channel=feed&fields=id,created_at,data")
      const all = await ops.get("/admin/notifications")
      const email = await ops.get("/admin/notifications?channel=email")
      const both = await ops.get("/admin/notifications?channel=feed&channel=email")
      const one = await ops.get("/admin/notifications/noti_1")

      expect(feed.status).toBe(200)
      expect([all.status, email.status, both.status, one.status]).toEqual([403, 403, 403, 403])
      expect((await admin.get("/admin/notifications?channel=email")).status).toBe(200)
    })

    it("keeps the shop's accounts, keys and people the owner's", async () => {
      const owner = as((await createAdminUser(http, getContainer())).headers)
      const admin = as((await createAdminUser(http, getContainer(), "admin")).headers)

      const account = await admin.post("/admin/integrations/credentials/paytr", {
        test_mode: true,
      })
      const key = await admin.post("/admin/api-access", { title: "Depo", scopes: ["orders:read"] })
      const upper = await admin.post("/ADMIN/API-ACCESS", {
        title: "Depo",
        scopes: ["orders:read"],
      })
      const iban = await admin.post("/admin/platform-settings/bank_transfer", { enabled: false })
      // Express decodes the section from the path: the escaped name is the same section
      const escaped = await admin.post("/admin/platform-settings/bank%5Ftransfer", {
        enabled: false,
      })
      const store = await admin.post("/admin/platform-settings/store", {
        timezone: "Europe/Istanbul",
      })
      const ownerKey = await owner.post("/admin/api-access", {
        title: "Depo",
        scopes: ["orders:read"],
      })

      expect([account.status, key.status, iban.status, escaped.status]).toEqual([
        403, 403, 403, 403,
      ])
      // Express routes regardless of case: the same route, refused the same way
      expect([403, 404]).toContain(upper.status)
      expect(store.status).toBe(200)
      expect(ownerKey.status).toBe(201)
    })

    it("lets read-only staff read, and nothing more", async () => {
      await createAdminUser(http, getContainer())
      const reader = as((await createAdminUser(http, getContainer(), "readonly")).headers)

      const orders = await reader.get("/admin/orders?limit=5")
      const ship = await reader.post("/admin/order-board/ship", { order_ids: ["order_1"] })
      const job = await reader.post("/admin/async-jobs", { type: "catalog.import", input: {} })

      expect(orders.status).toBe(200)
      expect([ship.status, job.status]).toEqual([403, 403])
    })

    it("takes a role away at the next request", async () => {
      await createAdminUser(http, getContainer())
      const admin = await createAdminUser(http, getContainer(), "admin")
      const before = await as(admin.headers).post("/admin/platform-settings/store", {
        timezone: "Europe/Istanbul",
      })

      await roles().setRole(admin.userId, "readonly", null)
      const after = await as(admin.headers).post("/admin/platform-settings/store", {
        timezone: "Europe/Istanbul",
      })

      expect(before.status).toBe(200)
      expect(after.status).toBe(403)
    })

    it("gives a shop's staff their roles when roles arrive: the first user owns it", async () => {
      const first = await createAdminUser(http, getContainer())
      const second = await createAdminUser(http, getContainer())
      // As before roles: nobody has one
      for (const row of await roles().listStaffRoles({})) {
        await roles().deleteStaffRoles(row.id)
      }

      await staffRolesInitial({ container: getContainer(), args: [] })

      expect(await roles().roleOf(first.userId)).toBe("owner")
      expect(await roles().roleOf(second.userId)).toBe("admin")
    })
  },
})
