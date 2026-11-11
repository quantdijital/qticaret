import type { MedusaContainer } from "@medusajs/framework/types"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { pullPlanDocument, warnIfStale } from "../../src/lib/control-plane/pull"
import { CONTROL_PLANE_MODULE } from "../../src/modules/control-plane"
import type ControlPlaneModuleService from "../../src/modules/control-plane/service"
import {
  MANAGED_ENV,
  doc,
  fakeControlPlane,
  listen,
  managedForThisFile,
  pullAnswer,
  signed,
} from "../helpers/control-plane"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"

jest.setTimeout(240 * 1000)

const DAY_AND_MORE = 25 * 60 * 60 * 1000

/**
 * adr/0061 §3.2, §3.3 (C9): the shop pulls its plan document with a signed
 * request; the answer must be bound to the request's own nonce (review
 * L3). With the control plane down the shop keeps its last document; 24
 * hours without a bound pull say so in the log, whatever was pushed.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    const container = (): MedusaContainer => getContainer()
    const plans = () => container().resolve<ControlPlaneModuleService>(CONTROL_PLANE_MODULE)
    const push = (body: unknown) => settle(http.post("/hooks/control-plane/plan", body))

    managedForThisFile()

    async function withControlPlane(
      answer: Parameters<typeof fakeControlPlane>[0],
      run: (seen: string[]) => Promise<void>
    ) {
      const { server, seen } = fakeControlPlane(answer)
      process.env["CONTROL_PLANE_URL"] = await listen(server)
      try {
        await run(seen)
      } finally {
        process.env["CONTROL_PLANE_URL"] = MANAGED_ENV.CONTROL_PLANE_URL
        server.close()
      }
    }

    it("keeps the last document while the control plane is down, and says so after 24 hours", async () => {
      await push(signed(doc(5, { status: "restricted" })))

      expect(await pullPlanDocument(container())).toEqual({ outcome: "unreachable" })
      expect(await plans().planState()).toMatchObject({ serial: 5, status: "restricted" })
      // Pushed, never pulled: not in touch (a push, even replayed, proves nothing)
      expect(await warnIfStale(container())).toBe(true)
    })

    it("pulls with a signed request and an answer bound to its nonce", async () => {
      let answer = (nonce: string): { status: number; body: unknown } => ({
        status: 200,
        body: pullAnswer(signed(doc(9)), nonce),
      })
      await withControlPlane(
        (nonce) => answer(nonce),
        async (seen) => {
          expect(await pullPlanDocument(container())).toEqual({ outcome: "applied", serial: 9 })
          const state = await plans().planState()
          expect(state.source).toBe("pull")
          expect(state.confirmed_at).not.toBeNull()
          expect(await warnIfStale(container())).toBe(false)
          expect(await warnIfStale(container(), new Date(Date.now() + DAY_AND_MORE))).toBe(true)

          // A pulled document is held to the push's rules: another shop's is refused
          answer = (nonce) => ({
            status: 200,
            body: pullAnswer(signed(doc(10, { tenant_id: "ten_01JOTHER00000000" })), nonce),
          })
          expect(await pullPlanDocument(container())).toMatchObject({
            outcome: "refused",
            code: "control_plane.wrong_tenant",
          })
          answer = () => ({ status: 404, body: { message: "plan.none" } })
          expect(await pullPlanDocument(container())).toEqual({ outcome: "none" })
          expect((await plans().planState()).serial).toBe(9)
          expect(seen).toEqual(["signed", "signed", "signed"])
        }
      )
    })

    it("refuses an answer bound to another request, or to none", async () => {
      const document = signed(doc(12))
      const old = pullAnswer(document, "AAECAwQFBgcICQoLDA0ODw")
      for (const body of [old, document, { ...old, extra: 1 }]) {
        await withControlPlane(
          () => ({ status: 200, body }),
          async () => {
            expect(await pullPlanDocument(container())).toEqual({ outcome: "bad_answer" })
          }
        )
      }
      expect(await plans().storedPlan(document.document.tenant_id)).toBeNull()
    })
  },
})
