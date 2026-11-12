import { randomInt } from "node:crypto"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { runFleetCommand } from "../../src/scripts/fleet"
import { makeMember } from "../helpers/staff"
import type { HttpClient, Member } from "../helpers/staff"
import { auditRows, client, makeTenant, proved } from "../helpers/tenants"
import { moveThrough, reportAt } from "../helpers/releases"

jest.setTimeout(240 * 1000)

interface Release {
  id: string
  version: string
  commit: string
  notes: string | null
  created_by: string | null
  reported_count: number
  target_count: number
}

interface Version {
  reported: { version: string; commit: string; reported_at: string } | null
  target: {
    id: string
    version: string
    commit: string
    set_at: string
    set_by: string | null
    reason: string | null
  } | null
  matches: boolean | null
}

const COMMIT = "8a128bbe0c3d4e5f60718293a4b5c6d7e8f90a1b"
// A version no other test in this file takes
const freshVersion = () => `${String(randomInt(100, 999))}.${String(randomInt(0, 99))}.0`

/**
 * adr/0061 F17.5, Ek C18: the releases the platform knows (added by who
 * runs shops, behind a step-up, a version once; never deleted, only the
 * note changes) and each shop's target (with a reason, recorded before
 * and after); what a shop runs comes from its latest usage report.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    const call = client(http)
    let owner: Member
    let operator: Member
    let finance: Member
    let readonly: Member

    beforeAll(async () => {
      owner = await makeMember(http, getContainer(), "owner")
      operator = await makeMember(http, getContainer(), "operator")
      finance = await makeMember(http, getContainer(), "finance")
      readonly = await makeMember(http, getContainer(), "readonly")
    })

    const addRelease = async (member: Member, body: Record<string, unknown> = {}, proof = true) =>
      call.post(
        "/admin/cp/releases",
        { version: freshVersion(), commit: COMMIT, notes: "Kargo etiketi düzeltmesi", ...body },
        member,
        proof ? await proved(http, member) : member.headers
      )

    const releaseOf = (answer: { data: unknown }) => (answer.data as { release: Release }).release

    const setTarget = async (member: Member, tenantId: string, body: Record<string, unknown>) =>
      call.post(
        `/admin/cp/tenants/${tenantId}/target-release`,
        body,
        member,
        await proved(http, member)
      )

    const versionOf = async (tenantId: string, member: Member = readonly) =>
      ((await call.get(`/admin/cp/tenants/${tenantId}`, member)).data as { version: Version })
        .version

    const listRow = async (tenantId: string) => {
      const list = await call.get("/admin/cp/tenants?limit=100", readonly)
      return (
        list.data as {
          tenants: {
            id: string
            version: { reported: { version: string } | null; drift: boolean }
          }[]
        }
      ).tenants.find((row) => row.id === tenantId)
    }

    it.each([
      ["owner", 200],
      ["operator", 200],
      ["finance", 403],
      ["readonly", 403],
    ] as const)("lets %s add a release: %i, behind a step-up", async (role, status) => {
      const member = { owner, operator, finance, readonly }[role]

      expect((await addRelease(member, {}, false)).status).toBe(status === 200 ? 428 : 403)
      expect((await addRelease(member, {}, status === 200)).status).toBe(status)
      expect((await call.get("/admin/cp/releases", member)).status).toBe(200)
    })

    it("refuses a known version and a bad one; keeps the commit in small letters, the note out of the audit", async () => {
      const version = freshVersion()
      const made = await addRelease(operator, { version, commit: COMMIT.toUpperCase() })

      expect(made.status).toBe(200)
      expect(releaseOf(made)).toMatchObject({
        version,
        commit: COMMIT,
        notes: "Kargo etiketi düzeltmesi",
      })
      const again = await addRelease(owner, { version, commit: "1234567" })
      expect([again.status, again.data["message"]]).toEqual([409, "cp.release_version_taken"])
      for (const body of [{ version: "1.4" }, { version: "01.4.0" }, { commit: "xyz1234" }]) {
        expect((await addRelease(owner, body)).status).toBe(400)
      }
      const list = (await call.get("/admin/cp/releases", readonly)).data as { releases: Release[] }
      expect(list.releases.filter((each) => each.version === version)).toHaveLength(1)
      expect(list.releases.find((each) => each.version === version)?.created_by).toBeTruthy()

      const audit = await auditRows(getContainer(), {
        action: "POST /admin/cp/releases",
        resource_id: releaseOf(made).id,
      })
      expect(audit[0]?.changes).toMatchObject({
        version: { to: version },
        commit: { to: COMMIT },
        notes: { length: "Kargo etiketi düzeltmesi".length },
      })
      expect(JSON.stringify(audit)).not.toContain("Kargo")
    })

    it("changes only a release's note, behind a step-up; an unknown one is 404, none is deleted", async () => {
      const made = releaseOf(await addRelease(owner))
      const path = `/admin/cp/releases/${made.id}`

      expect((await call.post(path, { notes: "Yeni not" }, operator)).status).toBe(428)
      expect((await call.post(path, { notes: "Yeni not" }, finance)).status).toBe(403)
      expect(
        (await call.post(path, { notes: "x", version: "9.9.9" }, owner, await proved(http, owner)))
          .status
      ).toBe(400)
      const changed = await call.post(
        path,
        { notes: "  Yeni not\r\n" },
        operator,
        await proved(http, operator)
      )
      expect(changed.status).toBe(200)
      expect(releaseOf(changed)).toMatchObject({
        id: made.id,
        version: made.version,
        notes: "Yeni not",
      })
      const cleared = await call.post(path, { notes: null }, operator, await proved(http, operator))
      expect(releaseOf(cleared).notes).toBeNull()
      const unknown = await call.post(
        "/admin/cp/releases/rel_unknown",
        { notes: "x" },
        owner,
        await proved(http, owner)
      )
      expect([unknown.status, unknown.data["message"]]).toEqual([404, "cp.release_unknown"])
      expect((await call.delete(path, owner)).status).toBe(404)

      const audit = await auditRows(getContainer(), {
        action: "POST /admin/cp/releases/:id",
        resource_id: made.id,
        outcome: 200,
      })
      expect(audit.map((each) => each.changes)).toEqual([
        expect.objectContaining({ notes: { from_length: 24, to_length: 8 } }),
        expect.objectContaining({ notes: { from_length: 8, to_length: 0 } }),
      ])
    })

    it("sets and clears a shop's target with a reason, recorded before and after; tells drift", async () => {
      const shop = await makeTenant(http, operator)
      const first = releaseOf(await addRelease(owner, { version: freshVersion() }))
      const second = releaseOf(await addRelease(owner, { version: freshVersion() }))
      const path = `/admin/cp/tenants/${shop.id}/target-release`

      expect(
        (await call.post(path, { release_id: first.id, reason: "Pilot" }, readonly)).status
      ).toBe(403)
      expect(
        (await call.post(path, { release_id: first.id, reason: "Pilot" }, operator)).status
      ).toBe(428)
      expect((await setTarget(operator, shop.id, { release_id: first.id })).status).toBe(400)
      expect(
        (await setTarget(operator, shop.id, { release_id: first.id, reason: " " })).status
      ).toBe(400)
      const unknown = await setTarget(operator, shop.id, {
        release_id: "rel_unknown",
        reason: "Pilot",
      })
      expect([unknown.status, unknown.data["message"]]).toEqual([404, "cp.release_unknown"])
      expect(await versionOf(shop.id)).toEqual({ reported: null, target: null, matches: null })

      const set = await setTarget(operator, shop.id, {
        release_id: first.id,
        reason: "Pilot grubu",
      })
      expect(set.status).toBe(200)
      expect((set.data as { version: Version }).version).toMatchObject({
        reported: null,
        target: { id: first.id, version: first.version, reason: "Pilot grubu" },
        matches: null,
      })
      // Why: to the roles that set targets only
      expect((await versionOf(shop.id, readonly)).target?.reason).toBeNull()
      const seen = (await versionOf(shop.id, operator)).target
      expect(seen?.reason).toBe("Pilot grubu")
      expect(typeof seen?.set_by).toBe("string")

      // It reports the target (a short hash of the same commit): matches
      await reportAt(getContainer(), shop.id, new Date(Date.now() - 60_000), {
        version: first.version,
        commit: COMMIT.slice(0, 12),
      })
      expect(await versionOf(shop.id)).toMatchObject({
        reported: { version: first.version, commit: COMMIT.slice(0, 12) },
        matches: true,
      })
      expect((await listRow(shop.id))?.version).toMatchObject({
        reported: { version: first.version },
        drift: false,
      })

      // A new target it does not run yet: drift, on the page and in the list
      await setTarget(owner, shop.id, { release_id: second.id, reason: "Genel yayın" })
      expect((await versionOf(shop.id)).matches).toBe(false)
      expect((await listRow(shop.id))?.version.drift).toBe(true)

      const cleared = await setTarget(operator, shop.id, {
        release_id: null,
        reason: "Geri alındı",
      })
      expect((cleared.data as { version: Version }).version).toMatchObject({
        target: null,
        matches: null,
      })
      expect((await listRow(shop.id))?.version.drift).toBe(false)

      const audit = await auditRows(getContainer(), {
        action: "POST /admin/cp/tenants/:id/target-release",
        resource_id: shop.id,
        outcome: 200,
      })
      expect(
        audit.map((each) => (each.changes as { target_release: unknown }).target_release)
      ).toEqual([
        { from: null, to: { id: first.id, version: first.version } },
        {
          from: { id: first.id, version: first.version },
          to: { id: second.id, version: second.version },
        },
        { from: { id: second.id, version: second.version }, to: null },
      ])
      expect(JSON.stringify(audit)).not.toContain("Pilot")
    })

    it("refuses a closing or closed shop's target, and counts only live shops per release", async () => {
      const release = releaseOf(await addRelease(owner))
      const live = await makeTenant(http, operator)
      const closed = await makeTenant(http, operator)
      await moveThrough(getContainer(), live.id, ["active"])
      await setTarget(operator, live.id, { release_id: release.id, reason: "Pilot" })
      await setTarget(operator, closed.id, { release_id: release.id, reason: "Pilot" })
      for (const shop of [live, closed]) {
        await reportAt(getContainer(), shop.id, new Date(Date.now() - 60_000), {
          version: release.version,
          commit: COMMIT,
        })
      }
      await moveThrough(getContainer(), closed.id, ["active", "closing"])

      const refused = await setTarget(operator, closed.id, {
        release_id: null,
        reason: "Kapanıyor",
      })
      expect([refused.status, refused.data["message"]]).toEqual([409, "cp.tenant_closed"])
      const list = (await call.get("/admin/cp/releases", readonly)).data as { releases: Release[] }
      expect(list.releases.find((each) => each.id === release.id)).toMatchObject({
        reported_count: 1,
        target_count: 1,
      })

      // The CLI's read: the same counts, no names
      const lines: string[] = []
      const write = jest.spyOn(process.stdout, "write").mockImplementation((chunk) => {
        lines.push(String(chunk))
        return true
      })
      try {
        expect(await runFleetCommand(getContainer(), ["releases"])).toBe(0)
      } finally {
        write.mockRestore()
      }
      expect(lines.join("")).toContain(
        `${release.version} commit=${COMMIT.slice(0, 12)} reported=1 targeted=1`
      )
    })
  },
})
