import { randomUUID } from "node:crypto"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import sharp from "sharp"
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
 * adr/0061 §5.3, Ek C14: the team and the media library at the package's
 * limits: a new seat or new bytes past them is 403 `plan.limit_reached`;
 * below them nothing changes. The month's AI credits: `ai.spec.ts`.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: { headers: Record<string, string> }
    const post = <T = Refusal>(url: string, body: unknown = {}) =>
      settle(http.post<T & Refusal>(url, body, { headers: admin.headers }))

    managedForThisFile()
    useFakeMail()

    beforeEach(async () => {
      admin = await createAdminUser(http, getContainer())
    })

    it("counts open invitations as seats and refuses the one past the team limit", async () => {
      await setPlanLimits(getContainer(), { staff: 2 })
      const invite = () =>
        post("/admin/staff/invites", { email: `ekip-${randomUUID()}@example.com`, role: "admin" })

      const first = await invite()
      const second = await invite()

      expect(first.status).toBe(201)
      expect(second.status).toBe(403)
      expect(second.data).toMatchObject({
        message: "plan.limit_reached",
        limit: "staff",
        used: 2,
        max: 2,
      })
    })

    it("refuses images past the storage limit by the size they bring, and every sheet", async () => {
      const upload = async (file: Buffer, type: string, name: string) => {
        const form = new FormData()
        form.append("files", new Blob([new Uint8Array(file)], { type }), name)
        return settle(
          http.post<Refusal & { files?: { id: string }[] }>("/admin/uploads", form, {
            headers: admin.headers,
          })
        )
      }
      await setPlanLimits(getContainer(), { storage_mb: 2 })
      const below = await upload(await photo(), "image/jpeg", "urun.jpg")

      // Two megabytes already kept in the library
      await getContainer()
        .resolve<MediaModuleService>(MEDIA_MODULE)
        .createMediaAssets([
          { url: "http://localhost/static/eski.jpg", file_id: "eski.jpg", size: 2 * MB - 1 },
        ])
      const past = await upload(await photo(), "image/jpeg", "yeni.jpg")
      const sheet = await upload(Buffer.from("Tanıtıcı;Ürün adı\nkupa;Kupa\n"), "text/csv", "u.csv")
      const fetched = await post("/admin/media/import", { url: "https://cdn.example.com/a.jpg" })

      expect(below.status).toBe(200)
      expect(past.status).toBe(403)
      expect(past.data).toMatchObject({
        message: "plan.limit_reached",
        limit: "storage_mb",
        max: 2,
      })
      // Review M4: images only; a sheet is the catalog import's own upload
      expect(sheet.status).toBe(400)
      expect(sheet.data.message).toBe("upload.unsupported_type")
      expect(fetched.status).toBe(403)
    })
  },
})
