import { generateKeyPairSync } from "node:crypto"
import { createServer } from "node:http"
import type { Server } from "node:http"
import type { AddressInfo } from "node:net"
import type { MedusaContainer } from "@medusajs/framework/types"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import {
  MemoryNonceStore,
  privateKeyFromSeed,
  rawPublicKey,
  signDocument,
  signerFromPrivateKey,
  verifySignedRequest,
} from "@qticaret/server-kit"
import type { Ed25519Signer } from "@qticaret/server-kit"
import { PLAN_DOCUMENT_PURPOSE } from "@qticaret/types/control-plane"
import type { PlanDocument } from "@qticaret/types/control-plane"
import {
  TENANT_ID,
  TEST_ONLY_CP_SEED,
  TEST_ONLY_TENANT_SEED,
  planDocument,
} from "@qticaret/types/control-plane/testing"
import { PLAN_PATH, pullPlanDocument, warnIfStale } from "../../src/lib/control-plane/pull"
import { CONTROL_PLANE_MODULE } from "../../src/modules/control-plane"
import type ControlPlaneModuleService from "../../src/modules/control-plane/service"
import { PLATFORM_SETTINGS_MODULE } from "../../src/modules/platform-settings"
import type PlatformSettingsModuleService from "../../src/modules/platform-settings/service"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"

jest.setTimeout(240 * 1000)

const cp = signerFromPrivateKey(privateKeyFromSeed(TEST_ONLY_CP_SEED))
const shop = signerFromPrivateKey(privateKeyFromSeed(TEST_ONLY_TENANT_SEED))
const PUSH = "/hooks/control-plane/plan"
const FLAG = "test.platform_sample"

const doc = (serial: number, changes: Partial<PlanDocument> = {}): PlanDocument => ({
  ...planDocument,
  serial,
  platform_flags: { [FLAG]: false },
  ...changes,
})

const signed = (document: PlanDocument, signer: Ed25519Signer = cp) => ({
  document,
  ...signDocument(PLAN_DOCUMENT_PURPOSE, document, signer),
})

/** A stand-in control plane for the pull: checks the shop's signed request, answers `answer()`. */
function fakeControlPlane(answer: () => { status: number; body: unknown }) {
  const nonces = new MemoryNonceStore()
  const seen: string[] = []
  const server = createServer((req, res) => {
    void verifySignedRequest(
      { method: req.method ?? "", path: req.url ?? "", headers: req.headers, body: "" },
      {
        publicKey: (kid, tenantId) =>
          kid === shop.kid && tenantId === TENANT_ID ? shop.privateKey : undefined,
        nonces,
      }
    ).then((verified) => {
      seen.push(verified.ok ? "signed" : verified.code)
      const { status, body } = verified.ok ? answer() : { status: 401, body: {} }
      res.writeHead(status, { "content-type": "application/json" })
      res.end(JSON.stringify(body))
    })
  })
  return { server, seen }
}

const listen = (server: Server) =>
  new Promise<string>((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      resolve(`http://127.0.0.1:${String((server.address() as AddressInfo).port)}`)
    })
  })

/**
 * adr/0061 §3.2, §3.3 (C9): the control plane's plan document pushed and
 * pulled. The shop is managed only inside this file: the variables are set
 * after boot and read per call (lib/control-plane/config.ts).
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    const push = (body: unknown) =>
      settle(http.post<{ message?: string; applied?: boolean }>(PUSH, body))
    const container = (): MedusaContainer => getContainer()
    const plans = () => container().resolve<ControlPlaneModuleService>(CONTROL_PLANE_MODULE)
    const flags = () => container().resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
    const saved: Record<string, string | undefined> = {}
    const managedEnv = {
      CONTROL_PLANE_PUBLIC_KEYS: rawPublicKey(cp.privateKey).toString("base64url"),
      TENANT_ID,
      TENANT_SIGNING_KEY: TEST_ONLY_TENANT_SEED.toString("base64url"),
      // Nothing listens here: the control plane is down unless a test says otherwise
      CONTROL_PLANE_URL: "http://127.0.0.1:9",
    }

    beforeAll(() => {
      for (const [name, value] of Object.entries(managedEnv)) {
        saved[name] = process.env[name]
        process.env[name] = value
      }
    })

    afterAll(() => {
      for (const [name, value] of Object.entries(saved)) {
        if (value === undefined) {
          Reflect.deleteProperty(process.env, name)
        } else {
          process.env[name] = value
        }
      }
    })

    it("applies a greater serial, takes the same one as a no-op and refuses an older one", async () => {
      expect((await push(signed(doc(7)))).data).toMatchObject({ applied: true, serial: 7 })
      expect(await plans().planState()).toMatchObject({
        managed: true,
        serial: 7,
        status: "active",
        package_code: "standart",
        limits: { products: 500, orders_per_month: null },
        source: "push",
      })
      // Its platform flag reaches the flag registry
      expect(await flags().isFeatureEnabled(FLAG)).toBe(false)

      const same = await push(signed(doc(7, { status: "suspended" })))
      expect(same.status).toBe(200)
      expect(same.data).toMatchObject({ applied: false, serial: 7 })
      expect((await plans().planState()).status).toBe("active")

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

    it("keeps the last document while the control plane is down, and says so after 24 hours", async () => {
      await push(signed(doc(5, { status: "restricted" })))

      expect(await pullPlanDocument(container())).toEqual({ outcome: "unreachable" })
      expect(await plans().planState()).toMatchObject({ serial: 5, status: "restricted" })
      expect(await warnIfStale(container())).toBe(false)
      expect(await warnIfStale(container(), new Date(Date.now() + 25 * 60 * 60 * 1000))).toBe(true)
    })

    it("pulls with a signed request and checks the answer as a push", async () => {
      let answer = { status: 200, body: signed(doc(9)) as unknown }
      const { server, seen } = fakeControlPlane(() => answer)
      process.env["CONTROL_PLANE_URL"] = await listen(server)
      try {
        expect(await pullPlanDocument(container())).toEqual({ outcome: "applied", serial: 9 })
        expect((await plans().planState()).source).toBe("pull")

        // A pulled document is held to the same rules: another shop's is refused
        answer = { status: 200, body: signed(doc(10, { tenant_id: "ten_01JOTHER00000000" })) }
        expect(await pullPlanDocument(container())).toMatchObject({
          outcome: "refused",
          code: "control_plane.wrong_tenant",
        })
        answer = { status: 404, body: { message: "plan.none" } }
        expect(await pullPlanDocument(container())).toEqual({ outcome: "none" })
        expect((await plans().planState()).serial).toBe(9)
        expect(seen.every((each) => each === "signed")).toBe(true)
        expect(seen.length).toBe(3)
      } finally {
        process.env["CONTROL_PLANE_URL"] = managedEnv.CONTROL_PLANE_URL
        server.close()
      }
    })

    it("is unmanaged without the public keys: 404, platform flags at their defaults", async () => {
      await push(signed(doc(4)))
      expect(await flags().isFeatureEnabled(FLAG)).toBe(false)

      const keys = process.env["CONTROL_PLANE_PUBLIC_KEYS"]
      delete process.env["CONTROL_PLANE_PUBLIC_KEYS"]
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
