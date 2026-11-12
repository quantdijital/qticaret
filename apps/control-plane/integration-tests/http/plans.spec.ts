import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { makeMember } from "../helpers/staff"
import type { HttpClient, Member } from "../helpers/staff"
import { auditRows, client, freshSlug, makeTenant, proved } from "../helpers/tenants"

jest.setTimeout(240 * 1000)

interface Plan {
  id: string
  code: string
  price: number
  archived_at: string | null
  tenant_count?: number
  limits: Record<string, number | null>
}

interface Limit {
  key: string
  package?: number | null
  override?: number | null
  value: number | null
}

/**
 * adr/0061 §2, §3.5 (C7): packages made and changed by finance, a price
 * behind a step-up; archiving one in use keeps its shops and takes no new
 * one; a shop's package and its exceptions with a reason; notes by their
 * author; the activity a shop's changes leave.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    const call = client(http)
    let owner: Member
    let operator: Member
    let otherOperator: Member
    let finance: Member
    let readonly: Member

    beforeAll(async () => {
      owner = await makeMember(http, getContainer(), "owner")
      operator = await makeMember(http, getContainer(), "operator")
      otherOperator = await makeMember(http, getContainer(), "operator")
      finance = await makeMember(http, getContainer(), "finance")
      readonly = await makeMember(http, getContainer(), "readonly")
    })

    // A new package sets a price: proved again (review M1)
    const newPlan = async (member: Member, body: Record<string, unknown> = {}, proof = true) =>
      call.post(
        "/admin/cp/plans",
        {
          code: freshSlug("paket"),
          name: "Başlangıç",
          price: 49_000,
          period: "monthly",
          trial_days: 14,
          limits: { products: 500, staff: 3 },
          ...body,
        },
        member,
        proof ? await proved(http, member) : member.headers
      )

    const planOf = (answer: { data: unknown }) => (answer.data as { plan: Plan }).plan

    const limitsOf = async (tenantId: string) =>
      (await call.get(`/admin/cp/tenants/${tenantId}`, readonly)).data as unknown as {
        limits: Limit[]
        package: Plan | null
      }

    it.each([
      ["owner", 200],
      ["finance", 200],
      ["operator", 403],
      ["readonly", 403],
    ] as const)("lets %s make a package: %i", async (role, status) => {
      const member = { owner, operator, finance, readonly }[role]

      // The step-up is asked of who may make one (review M1)
      expect((await newPlan(member, {}, false)).status).toBe(status === 200 ? 428 : 403)
      expect((await newPlan(member, {}, status === 200)).status).toBe(status)
      expect((await call.get("/admin/cp/plans", member)).status).toBe(200)
    })

    it("fills every registry limit and refuses a key the registry lacks, a bad code, a taken one", async () => {
      const made = planOf(await newPlan(finance))

      expect(made.limits).toEqual({
        products: 500,
        orders_per_month: null,
        staff: 3,
        storage_mb: null,
        llm_credits_per_month: null,
        custom_domains: null,
      })
      expect((await newPlan(finance, { limits: { seats: 3 } })).status).toBe(400)
      expect(JSON.stringify((await newPlan(finance, { code: "Paket 1" })).data)).toContain(
        "cp.package_code_invalid"
      )
      expect((await newPlan(finance, { code: made.code })).data).toMatchObject({
        message: "cp.package_code_taken",
      })
      expect((await newPlan(finance, { price: 10.5 })).status).toBe(400)
    })

    it("changes a price only with a step-up, recorded from and to", async () => {
      const made = planOf(await newPlan(finance))
      const path = `/admin/cp/plans/${made.id}/price`

      const unproved = await call.post(path, { price: 59_000, period: "monthly" }, finance)
      const priced = await call.post(
        path,
        { price: 59_000, period: "yearly" },
        finance,
        await proved(http, finance)
      )
      const renamed = await call.post(
        `/admin/cp/plans/${made.id}`,
        { name: "Esnaf", limits: { products: 800 } },
        finance
      )
      const rows = await auditRows(getContainer(), {
        resource_type: "package",
        resource_id: made.id,
        outcome: 200,
      })

      expect(unproved.status).toBe(428)
      expect(planOf(priced)).toMatchObject({ price: 59_000, period: "yearly" })
      expect(planOf(renamed)).toMatchObject({ name: "Esnaf", limits: { products: 800 } })
      expect(rows.map((row) => row.changes)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            price: { from: 49_000, to: 59_000 },
            period: { from: "monthly", to: "yearly" },
          }),
          expect.objectContaining({ "limits.products": { from: 500, to: 800 } }),
        ])
      )
    })

    it("changes the trial and grace days only with a step-up, never with the name (Ek C19 L1)", async () => {
      const made = planOf(await newPlan(finance))
      const path = `/admin/cp/plans/${made.id}/terms`

      const throughName = await call.post(
        `/admin/cp/plans/${made.id}`,
        { name: "Esnaf", grace_days: 60 },
        finance
      )
      const unproved = await call.post(path, { grace_days: 60 }, finance)
      const byOperator = await call.post(path, { grace_days: 60 }, operator)
      const empty = await call.post(path, {}, finance, await proved(http, finance))
      const termed = await call.post(
        path,
        { trial_days: 30, grace_days: 60 },
        finance,
        await proved(http, finance)
      )
      const rows = await auditRows(getContainer(), {
        resource_type: "package",
        resource_id: made.id,
        outcome: 200,
      })

      expect(throughName.status).toBe(400)
      expect(unproved.status).toBe(428)
      expect(byOperator.status).toBe(403)
      expect(JSON.stringify(empty.data)).toContain("cp.nothing_to_save")
      expect(planOf(termed)).toMatchObject({ trial_days: 30, grace_days: 60, name: "Başlangıç" })
      expect(rows.map((row) => row.changes)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            trial_days: { from: 14, to: 30 },
            grace_days: { from: 7, to: 60 },
          }),
        ])
      )
    })

    it("keeps an archived package on its shops and gives it to no new one", async () => {
      const made = planOf(await newPlan(owner))
      const first = await makeTenant(http, operator, { package_id: made.id })
      const second = await makeTenant(http, operator)

      const archived = await call.post(`/admin/cp/plans/${made.id}/archive`, {}, finance)
      const listed = (await call.get("/admin/cp/plans", readonly)).data as { plans: Plan[] }

      expect(planOf(archived).archived_at).not.toBeNull()
      expect(listed.plans.find((each) => each.id === made.id)).toMatchObject({ tenant_count: 1 })
      expect((await limitsOf(first.id)).package).toMatchObject({ id: made.id })
      const refused = await call.post(
        `/admin/cp/tenants/${second.id}/plan`,
        { package_id: made.id },
        operator,
        await proved(http, operator)
      )
      expect(refused.status).toBe(400)
      expect(refused.data).toMatchObject({ message: "cp.package_archived" })
      expect(
        (
          await call.post(
            "/admin/cp/tenants",
            { name: "C", slug: freshSlug(), package_id: made.id },
            owner,
            await proved(http, owner)
          )
        ).data
      ).toMatchObject({ message: "cp.package_archived" })

      await call.post(`/admin/cp/plans/${made.id}/restore`, {}, owner)
      expect(
        (
          await call.post(
            `/admin/cp/tenants/${second.id}/plan`,
            { package_id: made.id },
            operator,
            await proved(http, operator)
          )
        ).status
      ).toBe(200)
    })

    it("puts a shop on a package (operator), its exceptions over it with a reason", async () => {
      const made = planOf(await newPlan(finance))
      const { id } = await makeTenant(http, owner)
      const path = `/admin/cp/tenants/${id}/overrides`

      expect(
        (await call.post(`/admin/cp/tenants/${id}/plan`, { package_id: made.id }, finance)).status
      ).toBe(403)
      const assign = (headers: Record<string, string>) =>
        call.post(`/admin/cp/tenants/${id}/plan`, { package_id: made.id }, operator, headers)
      // What the shop pays: proved again, as a price change (review M1)
      expect((await assign(operator.headers)).status).toBe(428)
      expect((await assign(await proved(http, operator))).status).toBe(200)
      const noReason = await call.post(path, { key: "products", value: 2000, reason: "" }, operator)
      const ended = await call.post(
        path,
        {
          key: "products",
          value: 2000,
          reason: "Toplu ürün aktarımı",
          expires_at: "2020-01-01T00:00:00Z",
        },
        operator
      )
      expect(JSON.stringify(noReason.data)).toContain("reason")
      expect(JSON.stringify(ended.data)).toContain("cp.override_expired")
      expect(
        (await call.post(path, { key: "seats", value: 1, reason: "Deneme" }, operator)).status
      ).toBe(400)
      expect(
        (
          await call.post(
            path,
            { key: "products", value: 2000, reason: "Toplu ürün aktarımı" },
            readonly
          )
        ).status
      ).toBe(403)
      await call.post(
        path,
        { key: "products", value: 2000, reason: "Toplu ürün aktarımı" },
        operator
      )
      await call.post(path, { key: "staff", value: null, reason: "Kampanya dönemi" }, operator)

      const limits = (await limitsOf(id)).limits
      expect(limits.find((each) => each.key === "products")).toEqual({
        key: "products",
        package: 500,
        override: 2000,
        value: 2000,
      })
      expect(limits.find((each) => each.key === "staff")).toMatchObject({ package: 3, value: null })
      expect((await call.delete(`${path}/products`, operator)).status).toBe(200)
      expect((await call.delete(`${path}/products`, operator)).data).toMatchObject({
        message: "cp.override_unknown",
      })
      expect((await limitsOf(id)).limits.find((each) => each.key === "products")?.value).toBe(500)
    })

    it("lets a note's author or an owner change it, and lists the shop's activity with who", async () => {
      const { id } = await makeTenant(http, operator)
      const path = `/admin/cp/tenants/${id}/notes`

      expect((await call.post(path, { body: "x".repeat(2001) }, operator)).status).toBe(400)
      const note = await call.post(
        path,
        { body: "Sahibi kurulum için Salı günü aranacak.\nNumara yetkililerde." },
        operator
      )
      const noteId = (note.data as { note: { id: string } }).note.id

      expect(
        (await call.post(`${path}/${noteId}`, { pinned: true }, otherOperator)).data
      ).toMatchObject({
        message: "cp.note_not_yours",
      })
      expect((await call.post(`${path}/${noteId}`, { pinned: true }, operator)).status).toBe(200)
      expect(
        (await call.post(`/admin/cp/tenants/${id}`, { name: "Atölye Bıçakçılık" }, operator)).status
      ).toBe(200)
      expect((await call.delete(`${path}/${noteId}`, owner)).status).toBe(200)

      await auditRows(getContainer(), {}, 300)
      const activity = (await call.get(`/admin/cp/tenants/${id}/activity`, readonly)).data as {
        items: {
          kind: string
          action?: string
          actor: string | null
          changes?: Record<string, unknown>
        }[]
      }
      const actions = activity.items.filter((item) => item.kind === "action")

      expect(actions.map((item) => item.action)).toEqual([
        "DELETE /admin/cp/tenants/:id/notes/:note_id",
        "POST /admin/cp/tenants/:id",
        "POST /admin/cp/tenants/:id/notes/:note_id",
        "POST /admin/cp/tenants/:id/notes",
      ])
      expect(actions[1]?.changes).toMatchObject({
        name: { from: "Atölye Bıçak", to: "Atölye Bıçakçılık" },
      })
      expect(actions.every((item) => typeof item.actor === "string")).toBe(true)
      // A refused change and the reads stay out; the note's words never reach the log
      expect(JSON.stringify(activity)).not.toContain("Salı")
    })
  },
})
