import { readFileSync, readdirSync, rmSync } from "node:fs"
import { basename, join } from "node:path"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import sharp from "sharp"
import { PNG_1X1 } from "../../src/lib/security/__tests__/fixtures"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"

jest.setTimeout(60 * 1000)

// Where the local file provider stores uploads (its default upload_dir)
const STATIC_DIR = join(process.cwd(), "static")
const storedFiles = () => {
  try {
    return readdirSync(STATIC_DIR)
  } catch {
    return []
  }
}

const form = (...files: [content: Buffer | string, name: string, type: string][]) => {
  const data = new FormData()
  for (const [content, name, type] of files) {
    const bytes = typeof content === "string" ? content : new Uint8Array(content)
    data.append("files", new Blob([bytes], { type }), name)
  }
  return data
}

const SVG = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'

/** F2.9b KK: SVG and fake MIME uploads are refused (docs/04). */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    const created: string[] = []
    let upload: (
      data: FormData
    ) => Promise<{ status: number; data: { files?: { url: string }[]; message?: string } }>

    beforeEach(async () => {
      const admin = await createAdminUser(http, getContainer())
      upload = async (data) => {
        const response = await settle(
          http.post<{ files?: { url: string }[]; message?: string }>("/admin/uploads", data, {
            headers: admin.headers,
          })
        )
        created.push(...(response.data.files ?? []).map((file) => basename(file.url)))
        return response
      }
    })

    afterAll(() => {
      for (const name of created) {
        rmSync(join(STATIC_DIR, name), { force: true })
      }
    })

    it("stores a phone photo upright and without EXIF or GPS (F3.3 KK)", async () => {
      const photo = await sharp({
        create: { width: 60, height: 40, channels: 3, background: { r: 0, g: 90, b: 160 } },
      })
        .jpeg()
        .withExif({
          IFD0: { Make: "Phone", Copyright: "Ayşe" },
          IFD3: { GPSLatitudeRef: "N", GPSLatitude: "41/1 0/1 0/1" },
        })
        .withMetadata({ orientation: 6 })
        .toBuffer()
      const stored = await upload(form([photo, "IMG_0042.JPG", "image/jpeg"]))
      expect(stored.status).toBe(200)
      const name = basename(stored.data.files?.[0]?.url ?? "")
      const saved = await sharp(readFileSync(join(STATIC_DIR, name))).metadata()
      expect(saved.exif).toBeUndefined()
      expect(saved.orientation).toBeUndefined()
      expect([saved.width, saved.height]).toEqual([40, 60])
      expect(name).toMatch(/img-0042.*\.jpg$/)
    })

    it("refuses an image its header passes but whose pixels cannot be read", async () => {
      const truncated = PNG_1X1.subarray(0, PNG_1X1.length - 20)
      const broken = await upload(form([truncated, "broken.png", "image/png"]))
      expect(broken.status).toBe(400)
      expect(broken.data.message).toBe("upload.unreadable_image")
    })

    it("refuses an SVG and a fake image, and accepts a real PNG", async () => {
      const svg = await upload(form([SVG, "logo.svg", "image/svg+xml"]))
      const fake = await upload(form(["#!/bin/sh\necho hi", "photo.png", "image/png"]))
      const png = await upload(form([PNG_1X1, "photo.png", "image/png"]))

      expect(svg.status).toBe(400)
      expect(svg.data.message).toBe("upload.unsupported_type")
      expect(fake.status).toBe(400)
      expect(fake.data.message).toBe("upload.unsupported_type")
      expect(png.status).toBe(200)
      expect(png.data.files).toHaveLength(1)
    })

    it("stores image bytes under an image name, whatever name and type were sent", async () => {
      // A PNG header with HTML behind it: served as .html it would run script
      const polyglot = Buffer.concat([
        PNG_1X1,
        Buffer.from("<script>alert(document.cookie)</script>"),
      ])

      const response = await upload(form([polyglot, "logo.html", "text/html"]))

      expect(response.status).toBe(200)
      expect(response.data.files?.[0]?.url).toMatch(/-logo\.png$/)
    })

    // Medusa's own product import is closed (F3.9); a CSV is still a file the shop may keep
    it("accepts a plain CSV", async () => {
      const response = await upload(
        form(["Product Handle,Title\nsef-bicagi,Şef Bıçağı\n", "Ürünler.csv", "text/csv"])
      )

      expect(response.status).toBe(200)
      expect(response.data.files?.[0]?.url).toMatch(/-urunler\.csv$/)
    })

    it("stores nothing when one file of several is refused", async () => {
      const before = storedFiles().length

      const response = await upload(
        form([PNG_1X1, "a.png", "image/png"], [SVG, "b.svg", "image/svg+xml"])
      )

      expect(response.status).toBe(400)
      expect(storedFiles()).toHaveLength(before)
    })
  },
})
