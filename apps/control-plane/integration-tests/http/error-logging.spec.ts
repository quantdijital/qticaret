import { inspect } from "node:util"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { makeMember } from "../helpers/staff"
import type { HttpClient, Member } from "../helpers/staff"
import { client, makeTenant } from "../helpers/tenants"

jest.setTimeout(240 * 1000)

interface Knex {
  raw: (sql: string, params?: unknown[]) => Promise<unknown>
}

const EMAIL = "leyla.aksoy@sahafatolye.com.tr"
const PHONE_DIGITS = "5324182763"
const CONSTRAINT = "c19_refuse_contact"

/**
 * adr/0061 Ek C19 M1: a database error on a write is answered with the
 * generic 500 and logged by code. MikroORM's driver error carries its SQL
 * with the bound values (here a contact's e-mail and phone); neither the
 * answer nor any log line may hold them.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    const call = client(http)
    let owner: Member
    let operator: Member

    beforeAll(async () => {
      owner = await makeMember(http, getContainer(), "owner")
      operator = await makeMember(http, getContainer(), "operator")
    })

    const pg = () => getContainer().resolve<Knex>(ContainerRegistrationKeys.PG_CONNECTION)

    // Every way a line can leave the process: the container's logger,
    // the console and the raw streams
    function captureLogs(): { text: () => string; restore: () => void } {
      const seen: unknown[][] = []
      const spies: jest.SpyInstance[] = []
      const logger = getContainer().resolve<Record<string, unknown>>(
        ContainerRegistrationKeys.LOGGER
      )
      for (const name of ["info", "warn", "error", "debug", "log", "failure", "activity"]) {
        if (typeof logger[name] === "function") {
          spies.push(
            jest.spyOn(logger as Record<string, () => void>, name).mockImplementation((...args) => {
              seen.push(args)
            })
          )
        }
      }
      for (const name of ["log", "info", "warn", "error", "debug"] as const) {
        spies.push(
          jest.spyOn(console, name).mockImplementation((...args: unknown[]) => {
            seen.push(args)
          })
        )
      }
      for (const stream of [process.stdout, process.stderr]) {
        spies.push(
          jest.spyOn(stream, "write").mockImplementation((chunk: unknown) => {
            seen.push([String(chunk)])
            return true
          })
        )
      }
      return {
        text: () => seen.map((args) => inspect(args, { depth: 8 })).join("\n"),
        restore: () => {
          for (const spy of spies) {
            spy.mockRestore()
          }
        },
      }
    }

    it("answers a refused contact write with the generic 500 and logs its SQLSTATE only", async () => {
      const { id } = await makeTenant(http, owner)
      // A check the database refuses this one address with (23514)
      await pg().raw(
        `ALTER TABLE tenant_contact ADD CONSTRAINT ${CONSTRAINT} CHECK (email <> '${EMAIL}') NOT VALID`
      )
      const logs = captureLogs()
      let answer
      try {
        answer = await call.post(
          `/admin/cp/tenants/${id}/contacts`,
          { name: "Leyla Aksoy", role: "billing", email: EMAIL, phone: `0${PHONE_DIGITS}` },
          operator
        )
        // The audit line is written once the answer is sent
        await new Promise((resolve) => setTimeout(resolve, 300))
      } finally {
        logs.restore()
        await pg().raw(`ALTER TABLE tenant_contact DROP CONSTRAINT IF EXISTS ${CONSTRAINT}`)
      }

      const text = logs.text()
      for (const needle of [EMAIL, "sahafatolye", PHONE_DIGITS, "insert into", CONSTRAINT]) {
        expect(JSON.stringify(answer.data)).not.toContain(needle)
        expect(text).not.toContain(needle)
      }
      expect(text).toContain("http.request_failed")
      expect(text).toContain('"code":"23514"')
      expect(answer.status).toBe(500)
      expect(answer.data).toEqual({
        code: "unknown_error",
        type: "unknown_error",
        message: "An unknown error occurred.",
        request_id: expect.any(String) as unknown,
      })
    })

    it("keeps a refusal's own key and logs it as the code", async () => {
      const logs = captureLogs()
      let answer
      try {
        answer = await call.post(
          `/admin/cp/tenants/ten_01JZZZZZZZZZZZZZZZZZZZZZZZ/contacts`,
          { name: "Leyla Aksoy", role: "billing", email: EMAIL },
          operator
        )
      } finally {
        logs.restore()
      }

      expect(answer.status).toBe(404)
      expect(answer.data).toMatchObject({ message: "cp.tenant_unknown" })
      expect(logs.text()).not.toContain(EMAIL)
    })
  },
})
