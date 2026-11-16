import { generateKeyPairSync } from "node:crypto"
import type { MedusaContainer } from "@medusajs/framework/types"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { signerFromPrivateKey } from "@qticaret/server-kit"
import { TENANT_ID } from "@qticaret/types/control-plane/testing"
import { PLAN_PATH, pullPlanDocument } from "../../src/lib/control-plane/pull"
import { CONTROL_PLANE_MODULE } from "../../src/modules/control-plane"
import type ControlPlaneModuleService from "../../src/modules/control-plane/service"
import { PLATFORM_SETTINGS_MODULE } from "../../src/modules/platform-settings"
import type PlatformSettingsModuleService from "../../src/modules/platform-settings/service"
import { FLAG, cp, doc, managedForThisFile, signed } from "../helpers/control-plane"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"

jest.setTimeout(240 * 1000)

const PUSH = "/hooks/control-plane/plan"

/**
 * adr/0061 §3.2, §3.3 (C9): the control plane's plan document pushed. The
 * shop is managed only inside this file: the variables are set after boot
 * and read per call (lib/control-plane/config.ts).
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    const push = (body: unknown) =>
      settle(http.post<{ message?: string; applied?: boolean }>(PUSH, body))
    const container = (): MedusaContainer => getContainer()
    const plans = () => container().resolve<ControlPlaneModuleService>(CONTROL_PLANE_MODULE)
    const flags = () => container().resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)

    managedForThisFile()

    it("applies a greater serial, takes the same one as a no-op and refuses an older one", async () => {
      expect((await push(signed(doc(7)))).data).toMatchObject({ applied: true, serial: 7 })
      expect(await plans().planState()).toMatchObject({
        managed: true,
        serial: 7,
        status: "active",
        package_code: "standart",
        limits: { products: 500, orders_per_month: null },
        source: "push",
        // A push never makes the shop look in touch (review L3)
        confirmed_at: null,
      })
      // Its platform flag reaches the flag registry
      expect(await flags().isFeatureEnabled(FLAG)).toBe(false)

      const same = await push(signed(doc(7, { status: "suspended" })))
      expect(same.status).toBe(200)
      expect(same.data).toMatchObject({ applied: false, serial: 7 })
      expect(await plans().planState()).toMatchObject({ status: "active", confirmed_at: null })

      expect((await push(signed(doc(8)))).data).toMatchObject({ applied: true })
      // The replay of an older document
      const replay = await push(signed(doc(7)))
      expect(replay.status).toBe(409)
      expect(replay.data.message).toBe("control_plane.stale_serial")
      expect((await plans().storedPlan(TENANT_ID))?.serial).toBe(8)
    })

    it("refuses a forged signature, an unknown key and another shop's document", async () => {
      const stranger = signerFromPrivateKey(generateKeyPairSync("ed25519").privateKey)
      const forged = await push({ ...signed(doc(3), stranger), kid: cp.kid })
      const unknown = await push(signed(doc(3), stranger))
      const other = await push(signed(doc(3, { tenant_id: "ten_01JOTHERSHOP000000000000" })))

      expect([forged.status, forged.data.message]).toEqual([401, "signature.invalid"])
      expect([unknown.status, unknown.data.message]).toEqual([401, "signature.unknown_key"])
      expect([other.status, other.data.message]).toEqual([403, "control_plane.wrong_tenant"])
      expect(await plans().storedPlan(TENANT_ID)).toBeNull()
    })

    it("refuses unknown fields and a body over 16 KB before reading it", async () => {
      const extra = await push({ ...signed(doc(3)), note: "x" })
      const inner = { document: { ...doc(3), extra: 1 }, kid: cp.kid, signature: "A".repeat(86) }
      const big = await push({ ...signed(doc(3)), padding: "x".repeat(17 * 1024) })

      expect(extra.status).toBe(400)
      expect((await push(inner)).status).toBe(400)
      expect(big.status).toBe(413)
      expect(await plans().storedPlan(TENANT_ID)).toBeNull()
    })

    it("ends with the newer document's flags when two applies race (review M1)", async () => {
      for (let round = 0; round < 4; round += 1) {
        const base = 10 * (round + 1)
        await Promise.all([
          push(signed(doc(base + 5, { platform_flags: { [FLAG]: true } }))),
          push(signed(doc(base + 6, { platform_flags: { [FLAG]: false } }))),
        ])
        expect((await plans().storedPlan(TENANT_ID))?.serial).toBe(base + 6)
        expect(await flags().isFeatureEnabled(FLAG)).toBe(false)
      }
      // A late sync of an older document writes nothing over a newer one
      const late = await flags().syncPlatformFlags({ [FLAG]: true }, 3)
      expect(late.written).toBe(false)
      expect(await flags().isFeatureEnabled(FLAG)).toBe(false)
      // The same serial again heals a store that drifted
      await flags().syncPlatformFlags({ [FLAG]: true }, 46)
      expect((await push(signed(doc(46, { platform_flags: { [FLAG]: false } })))).status).toBe(200)
      expect(await flags().isFeatureEnabled(FLAG)).toBe(false)
    })

    // adr/0069 slice 1 review: Medusa's update deep-merged the stored JSON, so a key the
    // new document no longer named stayed, the row failed its signature and gave no flags
    it("stores a newer document whole: a flag or field it drops does not linger", async () => {
      const videos = "catalog.product_videos"
      const first = signed(
        doc(20, {
          platform_flags: { [FLAG]: true, [videos]: true },
          billing: { ...doc(20).billing, package_name: "Standart" },
        })
      )
      expect((await push(first)).data).toMatchObject({ applied: true })
      const second = signed(doc(21, { platform_flags: { [videos]: false } }))
      expect((await push(second)).data).toMatchObject({ applied: true })

      const stored = await plans().storedPlan(TENANT_ID)
      expect(stored?.document).toEqual(second.document)
      expect(await plans().planState()).toMatchObject({ serial: 21, status: "active" })
      expect(await flags().isFeatureEnabled(videos)).toBe(false)
      // Not named any more: back to its default, not the older document's value
      expect(await flags().isFeatureEnabled(FLAG)).toBe(true)
    })

    // Security review A-1: the row is written with bound values; a `?` or a quote in the
    // document's own words must neither break the write nor change what is stored
    it("stores a document whose words hold SQL's special characters exactly as signed", async () => {
      const words = (tag: string) => ({
        package_name: `Bıçak ${tag}? ?? 'tek' "çift" \\ $1 :ad %s 🔪`,
        payment_instruction: [
          `Havale ${tag}: IBAN TR00 0000? Açıklamaya sipariş no ?? yazın.`,
          `Tırnak ' ve " ve ters bölü \\ ve $1, $2::jsonb, :ad, %s, %%`,
          "Çok satırlı: ğüşöçİ ı 🔪🧾",
        ].join("\n"),
      })
      for (const [serial, tag] of [
        [30, "ilk"],
        [31, "ikinci"],
      ] as const) {
        const pushed = signed(doc(serial, { billing: { ...doc(serial).billing, ...words(tag) } }))
        const answer = await push(pushed)
        expect(answer.status).toBe(200)
        expect(answer.data).toMatchObject({ applied: true, serial })
        expect((await plans().storedPlan(TENANT_ID))?.document).toEqual(pushed.document)
        expect(await plans().planState()).toMatchObject({ serial, status: "active" })
      }
    })

    it("is unmanaged without the public keys: 404, platform flags at their defaults", async () => {
      await push(signed(doc(4)))
      expect(await flags().isFeatureEnabled(FLAG)).toBe(false)

      const keys = process.env["CONTROL_PLANE_PUBLIC_KEYS"]
      Reflect.deleteProperty(process.env, "CONTROL_PLANE_PUBLIC_KEYS")
      try {
        const answer = await push(signed(doc(6)))
        expect([answer.status, answer.data.message]).toEqual([404, "control_plane.unmanaged"])
        expect(await flags().isFeatureEnabled(FLAG)).toBe(true)
        expect(await plans().planState()).toMatchObject({ managed: false, status: "active" })
        expect(await pullPlanDocument(container())).toEqual({ outcome: "unmanaged" })
      } finally {
        process.env["CONTROL_PLANE_PUBLIC_KEYS"] = keys
      }
    })

    it("asks for the plan path the control plane serves", () => {
      expect(PLAN_PATH).toBe("/tenant-api/v1/plan")
    })
  },
})
