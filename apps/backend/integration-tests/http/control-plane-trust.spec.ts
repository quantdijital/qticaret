import type { Knex } from "@medusajs/framework/mikro-orm/knex"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { TENANT_ID } from "@qticaret/types/control-plane/testing"
import { logger } from "../../src/lib/logging"
import { CONTROL_PLANE_MODULE } from "../../src/modules/control-plane"
import type ControlPlaneModuleService from "../../src/modules/control-plane/service"
import { PLATFORM_SETTINGS_MODULE } from "../../src/modules/platform-settings"
import type PlatformSettingsModuleService from "../../src/modules/platform-settings/service"
import { FLAG, doc, managedForThisFile, signed } from "../helpers/control-plane"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"

jest.setTimeout(240 * 1000)

const PUSH = "/hooks/control-plane/plan"

interface Cached {
  cache: { invalidate: () => Promise<void> }
}

/**
 * adr/0061 Ek C19 I1–I3: what the shop believes of its stored plan
 * document. A replayed push reloads nothing; a row changed in the
 * database is not believed (the last verified state stays); a row for
 * another shop restricts this one until a valid document arrives.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    const push = (body: unknown) =>
      settle(http.post<{ message?: string; applied?: boolean }>(PUSH, body))
    const plans = () => getContainer().resolve<ControlPlaneModuleService>(CONTROL_PLANE_MODULE)
    const flags = () =>
      getContainer().resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
    const pg = () => getContainer().resolve<Knex>(ContainerRegistrationKeys.PG_CONNECTION)
    const eventsLogged = (spy: jest.SpyInstance) =>
      spy.mock.calls.map((call: unknown[]) => (call[0] as { event?: string }).event)

    managedForThisFile()

    afterEach(() => {
      jest.restoreAllMocks()
    })

    it("reloads nothing for a replayed push: no cache dropped, no row written (I1)", async () => {
      expect((await push(signed(doc(5, { platform_flags: { [FLAG]: true } })))).status).toBe(200)
      const before = await pg()("platform_flag").select("id", "updated_at")
      const planCache = jest.spyOn((plans() as unknown as Cached).cache, "invalidate")
      const flagCache = jest.spyOn((flags() as unknown as Cached).cache, "invalidate")

      const replayed = await push(signed(doc(5, { platform_flags: { [FLAG]: true } })))

      expect(replayed.data).toMatchObject({ applied: false })
      expect(planCache).not.toHaveBeenCalled()
      expect(flagCache).not.toHaveBeenCalled()
      expect(await pg()("platform_flag").select("id", "updated_at")).toEqual(before)
      // A new document still reloads both
      expect((await push(signed(doc(6, { platform_flags: { [FLAG]: false } })))).status).toBe(200)
      expect(planCache).toHaveBeenCalled()
      expect(flagCache).toHaveBeenCalled()
    })

    it("does not believe a row changed in the database; keeps the last verified state (I2)", async () => {
      expect((await push(signed(doc(10, { status: "active" })))).status).toBe(200)
      expect(await plans().planState()).toMatchObject({ status: "active", serial: 10 })
      const errors = jest.spyOn(logger, "error")

      await pg().raw(
        `UPDATE control_plane_plan SET document = jsonb_set(document, '{status}', '"suspended"')`
      )
      await plans().reloadPlanState()

      expect(await plans().planState()).toMatchObject({ status: "active", serial: 10 })
      expect(errors).toHaveBeenCalledWith(
        expect.objectContaining({
          event: "control_plane.stored_invalid",
          code: "signature.invalid",
          kept: true,
        })
      )
      expect(JSON.stringify(errors.mock.calls)).not.toContain("suspended")
      // A valid document replaces the row
      expect((await push(signed(doc(11, { status: "restricted" })))).status).toBe(200)
      expect(await plans().planState()).toMatchObject({ status: "restricted", serial: 11 })
    })

    it("restricts the shop for another shop's row, and is active with none at all (I3)", async () => {
      expect((await push(signed(doc(20)))).status).toBe(200)
      const errors = jest.spyOn(logger, "error")
      const saved = process.env["TENANT_ID"]
      try {
        process.env["TENANT_ID"] = "ten_01JZZZZZZZZZZZZZZZZZZZZZZZ"
        await plans().reloadPlanState()
        expect(await plans().planState()).toMatchObject({ managed: true, status: "restricted" })
        expect(eventsLogged(errors)).toContain("control_plane.tenant_mismatch")

        await pg()("control_plane_plan").delete()
        await plans().reloadPlanState()
        expect(await plans().planState()).toMatchObject({ status: "active", serial: null })
      } finally {
        process.env["TENANT_ID"] = saved
        await plans().reloadPlanState()
      }
      expect(saved).toBe(TENANT_ID)
      expect((await push(signed(doc(21)))).data).toMatchObject({ applied: true })
    })
  },
})
