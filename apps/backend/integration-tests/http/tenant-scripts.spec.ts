import { randomUUID } from "node:crypto"
import { Readable } from "node:stream"
import type { MedusaContainer } from "@medusajs/framework/types"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { readTenantResult } from "@qticaret/types/control-plane"
import { createOwnerInvite } from "../../src/lib/staff/owner-invite"
import { CONTROL_PLANE_MODULE } from "../../src/modules/control-plane"
import type ControlPlaneModuleService from "../../src/modules/control-plane/service"
import inviteOwner, { emailArg } from "../../src/scripts/invite-owner"
import planImport, { importPlanDocument, readInput } from "../../src/scripts/plan-import"
import { createAdminUser } from "../helpers/admin"
import { doc, managedForThisFile, signed } from "../helpers/control-plane"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"

jest.setTimeout(240 * 1000)

/** What a script printed on stdout while `run` ran. */
async function stdoutOf(run: () => Promise<void>): Promise<string> {
  const written: string[] = []
  const spy = jest.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => {
    written.push(String(chunk))
    return true
  })
  try {
    await run()
  } finally {
    spy.mockRestore()
  }
  return written.join("")
}

/**
 * adr/0061 §5.7, Ek C10: the provisioner's commands in the shop. The
 * owner's invitation is the first person in, made owner on acceptance and
 * dead once anyone is staff; the first plan document is checked exactly
 * as a push.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    const container = (): MedusaContainer => getContainer()

    managedForThisFile()

    async function accept(token: string, email: string) {
      // Throwaway credential for this test database only
      const password = randomUUID()
      const registered = await http.post<{ token: string }>("/auth/user/emailpass/register", {
        email,
        password,
      })
      return await settle(
        http.post<{ member?: { role: string }; message?: string }>(
          "/admin/staff/invites/accept",
          { token, first_name: "Elif", last_name: "Kaya" },
          { headers: { authorization: `Bearer ${registered.data.token}` } }
        )
      )
    }

    describe("tenant:invite-owner", () => {
      it("prints one result line with the token, no link; accepted, the person is the owner", async () => {
        const email = `sahip-${randomUUID().slice(0, 8)}@example.com`
        const out = await stdoutOf(() =>
          inviteOwner({ container: container(), args: [`email=${email.toUpperCase()}`] })
        )
        const result = readTenantResult(out) as { status: string; token: string }
        expect(Object.keys(result).sort()).toEqual(["status", "token"])
        expect(result.status).toBe("invited")
        expect(out).not.toContain("/invite")
        // The token appears on the result line only
        expect(out.split(result.token).length - 1).toBe(1)

        const info = await settle(
          http.post<{ email: string; role: string }>("/admin/staff/invites/info", {
            token: result.token,
          })
        )
        expect(info.data).toEqual({ email, role: "owner" })

        const accepted = await accept(result.token, email)
        expect(accepted.status).toBe(201)
        expect(accepted.data.member?.role).toBe("owner")

        // Someone is in: no new invitation, and the shop says why
        expect(await createOwnerInvite(container(), "baska@example.com")).toEqual({
          status: "owner_exists",
        })
      })

      it("sending again voids the earlier link; once staff exist the setup link is dead", async () => {
        const email = `sahip-${randomUUID().slice(0, 8)}@example.com`
        const first = await createOwnerInvite(container(), email)
        const second = await createOwnerInvite(container(), email)
        if (first.status !== "invited" || second.status !== "invited") {
          throw new Error("no invitation")
        }
        expect(first.token).not.toBe(second.token)
        expect((await accept(first.token, email)).status).toBe(400)

        // Another person joins first (the first-user rule): the setup link no longer opens
        await createAdminUser(http, container())
        const late = await accept(second.token, `sonra-${randomUUID().slice(0, 8)}@example.com`)
        expect(late.status).toBe(400)
        const info = await settle(http.post("/admin/staff/invites/info", { token: second.token }))
        expect(info.status).toBe(400)
      })

      it("refuses a missing or malformed address", () => {
        expect(() => emailArg([])).toThrow("email=<address> is required")
        expect(() => emailArg(["email=not-an-address"])).toThrow()
        expect(emailArg(["store-name=x", "email= Sahip@Example.com "])).toBe("sahip@example.com")
      })
    })

    describe("tenant:plan-import", () => {
      const plans = () => container().resolve<ControlPlaneModuleService>(CONTROL_PLANE_MODULE)

      it("stores the first document as a push would, then takes it again as a no-op", async () => {
        const body = JSON.stringify(signed(doc(1)))
        expect(await readInput(Readable.from([Buffer.from(body)]))).toBe(body)
        expect(await importPlanDocument(container(), body)).toEqual({
          status: "applied",
          serial: 1,
        })
        expect(await plans().planState()).toMatchObject({ managed: true, serial: 1 })
        expect(await importPlanDocument(container(), body)).toEqual({ status: "same", serial: 1 })
      })

      it("refuses a forged, foreign or unreadable document and changes nothing", async () => {
        const forged = signed(doc(5))
        forged.document = { ...forged.document, package_code: "baska" }
        expect(await importPlanDocument(container(), JSON.stringify(forged))).toEqual({
          status: "refused",
          code: "signature.invalid",
        })
        expect(await importPlanDocument(container(), "{ not json")).toEqual({
          status: "refused",
          code: "control_plane.document_invalid",
        })
        expect(await importPlanDocument(container(), null)).toMatchObject({ status: "refused" })
        expect(await readInput(Readable.from([Buffer.alloc(17 * 1024)]))).toBeNull()
      })

      it("sets exit code 1 when the document is refused", async () => {
        const stdin = Object.getOwnPropertyDescriptor(process, "stdin")
        Object.defineProperty(process, "stdin", {
          value: Readable.from([Buffer.from("{}")]),
          configurable: true,
        })
        try {
          const out = await stdoutOf(() => planImport({ container: container(), args: [] }))
          expect(readTenantResult(out)).toMatchObject({ status: "refused" })
          expect(process.exitCode).toBe(1)
        } finally {
          process.exitCode = 0
          if (stdin) {
            Object.defineProperty(process, "stdin", stdin)
          }
        }
      })
    })
  },
})
