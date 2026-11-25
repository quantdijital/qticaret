import { randomUUID } from "node:crypto"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { pgOf } from "../helpers/ai-credits"
import { anyStatus, makeMember } from "../helpers/staff"
import type { Answer, HttpClient, Member } from "../helpers/staff"
import { client, proved } from "../helpers/tenants"
import { captureOutput, tablesHolding } from "../helpers/vault"

jest.setTimeout(240 * 1000)

const P = "/admin/cp/ai/providers"

/**
 * adr/0085 "Güvenlik": a provider's key is refused without being repeated
 * (no answer, log or table holds a refused value), only a service of the
 * shared table spelled as it is names a key, and a key held is in no table
 * in the clear while it is held, not only after it is gone.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    const call = client(http)
    let owner: Member

    beforeAll(async () => {
      owner = await makeMember(http, getContainer(), "owner")
    })

    const post = async (path: string, body: unknown) =>
      call.post(path, body, owner, await proved(http, owner))
    const remove = async (path: string) =>
      http.delete(path, { ...anyStatus, headers: await proved(http, owner) })
    const vaultRows = async () => {
      const { rows } = await pgOf(getContainer()).raw(
        "SELECT count(*)::int AS n FROM secret_record"
      )
      return rows[0]?.["n"]
    }
    const messageOf = (answer: Answer) => (answer.data as { message?: string }).message

    it("refuses a malformed key without repeating it anywhere", async () => {
      const tag = randomUUID()
      const refused: [unknown, string][] = [
        [{ api_key: `test-long-${tag}-`.padEnd(513, "x") }, `test-long-${tag}-`],
        [{ api_key: `test key ${tag}` }, `test key ${tag}`],
        [{ api_key: `test-kéy-${tag}` }, `test-kéy-${tag}`],
        [{ api_key: `test-line-${tag}\n` }, `test-line-${tag}`],
        [{ api_key: 918_273_645_501 }, "918273645501"],
        [{ api_key: [`test-list-${tag}`] }, `test-list-${tag}`],
        [{ api_key: { value: `test-obj-${tag}` } }, `test-obj-${tag}`],
        [{ api_key: `test-extra-${tag}`, note: `test-note-${tag}` }, `test-extra-${tag}`],
        [{ key: `test-named-${tag}` }, `test-named-${tag}`],
      ]
      const before = await vaultRows()
      const answers: Answer[] = []
      const { output } = await captureOutput(async () => {
        for (const [body] of refused) {
          answers.push(await post(`${P}/fake`, body))
        }
      })
      expect(answers.map((each) => each.status)).toEqual(refused.map(() => 400))
      const told = JSON.stringify(answers.map((each) => each.data))
      for (const [, value] of refused) {
        expect([value, told.includes(value)]).toEqual([value, false])
        expect([value, output.includes(value)]).toEqual([value, false])
      }
      expect(told).not.toContain(`test-note-${tag}`)
      expect(output).not.toContain(`test-note-${tag}`)
      expect(
        await tablesHolding(getContainer(), [tag, "918273645501", `test-note-${tag}`])
      ).toEqual([])
      expect(await vaultRows()).toBe(before)
    })

    it("names a key only by a service of the table, spelled as it is", async () => {
      const secret = `test-key-${randomUUID()}`
      const before = await vaultRows()
      const names = [
        "cp_signing_key.x",
        "cp_signing_key",
        "FAKE",
        "Fake",
        "%66ake",
        "fak%65",
        "fake%20",
        "fake.",
        "f".repeat(65),
        `fake${"x".repeat(61)}`,
        "nobody",
      ]
      for (const name of names) {
        const written = await post(`${P}/${name}`, { api_key: secret })
        expect([name, written.status]).toEqual([name, 404])
        const dropped = await remove(`${P}/${name}`)
        expect([name, dropped.status]).toEqual([name, 404])
      }
      expect(messageOf(await post(`${P}/%66ake`, { api_key: secret }))).toBe(
        "cp.ai_service_unknown"
      )
      expect(await vaultRows()).toBe(before)
      expect(await tablesHolding(getContainer(), [secret])).toEqual([])
    })

    it("holds a written key in no table in the clear, while held and after", async () => {
      const secret = `test-key-${randomUUID()}`
      const part = secret.slice(9, 25)
      expect((await post(`${P}/fake`, { api_key: secret })).status).toBe(200)
      expect(await tablesHolding(getContainer(), [secret, part])).toEqual([])
      expect((await remove(`${P}/fake`)).status).toBe(200)
      expect(await tablesHolding(getContainer(), [secret, part])).toEqual([])
    })
  },
})
