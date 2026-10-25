import { moduleIntegrationTestRunner } from "@medusajs/test-utils"
import { AUDIT_LOG_MODULE } from ".."
import type AuditLogModuleService from "../service"

jest.setTimeout(120 * 1000)

const messageOf = async (run: () => unknown): Promise<unknown> => {
  try {
    await run()
  } catch (error) {
    return (error as { message?: unknown }).message
  }
  return "no error"
}

moduleIntegrationTestRunner<AuditLogModuleService>({
  moduleName: AUDIT_LOG_MODULE,
  resolve: "./src/modules/audit-log",
  testSuite: ({ service }) => {
    it("records an entry and lists it newest first", async () => {
      await service.record({ kind: "system", action: "seo.redirect_created" })
      const entry = await service.record({
        kind: "mutation",
        action: "POST /admin/products/:id",
        actor_type: "user",
        actor_id: "user_1",
        resource_type: "product",
        resource_id: "prod_1",
        outcome: 200,
        changes: { fields: ["title"] },
        request_id: "req-12345678",
      })

      const [entries, count] = await service.listAndCountAuditEntries(
        {},
        { order: { created_at: "DESC" } }
      )

      expect(entry.id).toMatch(/^aud_/)
      expect(count).toBe(2)
      expect(entries[0]).toMatchObject({ id: entry.id, changes: { fields: ["title"] } })
    })

    it("bounds what one entry can hold", async () => {
      const entry = await service.record({
        kind: "mutation",
        action: "x".repeat(1000),
        user_agent: "u".repeat(2000),
        changes: { big: "y".repeat(20_000) },
      })

      expect(entry.action).toHaveLength(256)
      expect(entry.user_agent).toHaveLength(512)
      expect(entry.changes).toEqual({ truncated: true, fields: ["big"] })
    })

    it("refuses an unknown kind", async () => {
      expect(
        await messageOf(() => service.record({ kind: "other" as "system", action: "x" }))
      ).toBe("audit_log.kind_invalid")
    })

    it("never changes or removes an entry", async () => {
      const entry = await service.record({ kind: "system", action: "job.run" })

      // Called past the types on purpose: in code these calls do not compile
      const writers = service as unknown as Record<string, (...args: unknown[]) => unknown>
      for (const write of [
        () => writers["updateAuditEntries"]?.({ id: entry.id, action: "changed" }),
        () => writers["deleteAuditEntries"]?.(entry.id),
        () => writers["softDeleteAuditEntries"]?.(entry.id),
        () => writers["restoreAuditEntries"]?.(entry.id),
      ]) {
        expect(await messageOf(write)).toBe("audit entries are append-only")
      }
      expect(await service.retrieveAuditEntry(entry.id)).toMatchObject({ action: "job.run" })
    })
  },
})
