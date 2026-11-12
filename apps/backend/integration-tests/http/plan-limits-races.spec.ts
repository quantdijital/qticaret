import { randomUUID } from "node:crypto"
import type { Knex } from "@medusajs/framework/mikro-orm/knex"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import sharp from "sharp"
import { megabytesOf } from "../../src/lib/control-plane/usage"
import { MEDIA_MODULE } from "../../src/modules/media"
import type MediaModuleService from "../../src/modules/media/service"
import { createAdminUser } from "../helpers/admin"
import { managedForThisFile } from "../helpers/control-plane"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { setPlanLimits } from "../helpers/plan-limits"
import type { Refusal } from "../helpers/plan-limits"
import { useFakeMail } from "../helpers/staff-account"

jest.setTimeout(240 * 1000)

const MB = 1024 * 1024

const photo = () =>
  sharp({ create: { width: 64, height: 64, channels: 3, background: { r: 30, g: 120, b: 80 } } })
    .jpeg()
    .toBuffer()

/**
 * adr/0061 Ek C14 review: the ways round a limit the first version left
 * open. Uploads count the moment they are stored (H1), an expired
 * invitation sent again takes a seat again (M1), and two invitations sent
 * together cannot both take the last seat (M2).
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: { headers: Record<string, string> }
    const post = <T = Refusal>(url: string, body: unknown = {}) =>
      settle(http.post<T & Refusal>(url, body, { headers: admin.headers }))
    const media = () => getContainer().resolve<MediaModuleService>(MEDIA_MODULE)
    const invite = () =>
      post<{ invite: { id: string } }>("/admin/staff/invites", {
        email: `ekip-${randomUUID()}@example.com`,
        role: "operations",
      })

    managedForThisFile()
    useFakeMail()

    beforeEach(async () => {
      admin = await createAdminUser(http, getContainer())
    })

    it("counts each upload as it is stored, so repeated ones stop at the limit", async () => {
      const upload = async () => {
        const form = new FormData()
        form.append(
          "files",
          new Blob([new Uint8Array(await photo())], { type: "image/jpeg" }),
          "u.jpg"
        )
        return post<{ files: { id: string; url: string }[] }>("/admin/uploads", form)
      }
      await setPlanLimits(getContainer(), { storage_mb: 1 })

      const first = await upload()
      const [record] = await media().listMediaAssets({ file_id: first.data.files[0]?.id })
      const size = record?.size ?? 0
      // Kept already: all but one and a half more of these
      await media().createMediaAssets([
        {
          url: "http://localhost/static/eski.jpg",
          file_id: "eski.jpg",
          size: Math.floor(MB - 2.5 * size),
        },
      ])
      const second = await upload()
      const third = await upload()
      // The panel's gallery registers what it uploaded: the record made at upload answers
      const registered = await post<{ media: { id: string }[] }>("/admin/media", {
        file_ids: [first.data.files[0]?.id],
      })

      expect(size).toBeGreaterThan(0)
      expect(record).toMatchObject({
        in_library: false,
        attached_at: null,
        uploaded_by: expect.any(String) as unknown,
      })
      expect([first.status, second.status, third.status]).toEqual([200, 200, 403])
      expect(third.data).toMatchObject({
        message: "plan.limit_reached",
        limit: "storage_mb",
        max: 1,
      })
      expect(megabytesOf(await media().storedBytes())).toBeLessThanOrEqual(1)
      expect(registered.status).toBe(200)
      expect(registered.data.media.map((each) => each.id)).toEqual([record?.id])
    })

    it("holds an expired invitation sent again to the team limit; a live one keeps its seat", async () => {
      await setPlanLimits(getContainer(), { staff: 2 })
      const expired = await invite()
      // A day later it has lapsed: the seat is free again
      await getContainer()
        .resolve<Knex>(ContainerRegistrationKeys.PG_CONNECTION)("invite")
        .where({ id: expired.data.invite.id })
        .update({ expires_at: new Date(Date.now() - 1000) })
      const live = await invite()

      const revived = await post(`/admin/staff/invites/${expired.data.invite.id}/resend`)
      const again = await post(`/admin/staff/invites/${live.data.invite.id}/resend`)

      expect([expired.status, live.status]).toEqual([201, 201])
      expect(revived.status).toBe(403)
      expect(revived.data).toMatchObject({ message: "plan.limit_reached", limit: "staff", max: 2 })
      expect(again.status).toBe(200)
    })

    it("never lets two expired invitations sent again together both take the last seat (Ek C19 L3)", async () => {
      await setPlanLimits(getContainer(), { staff: 3 })
      const pg = getContainer().resolve<Knex>(ContainerRegistrationKeys.PG_CONNECTION)
      const lapsed = [await invite(), await invite()]
      const ids = lapsed.map((answer) => answer.data.invite.id)
      const past = new Date(Date.now() - 1000)
      await pg("invite").whereIn("id", ids).update({ expires_at: past })
      // One seat left: the owner and one member's worth of open invitation
      const holder = await invite()

      const answers = await Promise.all(ids.map((id) => post(`/admin/staff/invites/${id}/resend`)))
      const rows = await pg<{ id: string; expires_at: Date }>("invite")
        .whereIn("id", ids)
        .select("id", "expires_at")
      const open = rows.filter((row) => new Date(row.expires_at).getTime() > Date.now())

      expect(holder.status).toBe(201)
      expect(answers.filter((answer) => answer.status === 200).length).toBeLessThanOrEqual(1)
      for (const answer of answers.filter((each) => each.status !== 200)) {
        expect(answer.status).toBe(403)
        expect(answer.data).toMatchObject({ message: "plan.limit_reached", limit: "staff" })
      }
      // A refused one is expired again: its fresh link is dead
      expect(open).toHaveLength(answers.filter((answer) => answer.status === 200).length)
    })

    it("never lets two invitations sent together both take the last seat", async () => {
      await setPlanLimits(getContainer(), { staff: 2 })

      const answers = await Promise.all([invite(), invite()])
      const made = answers.filter((answer) => answer.status === 201).length
      const open = await getContainer()
        .resolve(Modules.USER)
        .listInvites({}, { select: ["id"] })

      expect(made).toBeLessThanOrEqual(1)
      expect(answers.every((answer) => answer.status === 201 || answer.status === 403)).toBe(true)
      expect(open).toHaveLength(made)
    })
  },
})
