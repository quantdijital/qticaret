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

// Nothing of an SVG left once cleaned: refused
const EMPTY_SVG = "<svg><foreignObject><p>x</p>"

/**
 * F2.9b KK: fake MIME uploads are refused (docs/04); an SVG is told by its
 * content and stored only as cleaned (the logos' and site icon's, 2026-11-16).
 */
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

    it("stores an SVG cleaned, refuses one with nothing left and a fake image, accepts a real PNG", async () => {
      const svg = await upload(
        form([
          `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 10" onload="alert(1)"><script>alert(2)</script><rect width="5" height="5" fill="#c00" onclick="alert(3)"/><use href="https://evil.example/x.svg#a"/></svg>`,
          "logo.png",
          "image/png",
        ])
      )
      const empty = await upload(form(["<svg><foreignObject>", "x.svg", "image/svg+xml"]))
      const fake = await upload(form(["#!/bin/sh\necho hi", "photo.png", "image/png"]))
      const png = await upload(form([PNG_1X1, "photo.png", "image/png"]))

      // Told by its content, named and stored as what it is, and only as cleaned
      expect(svg.status).toBe(200)
      const name = basename(svg.data.files?.[0]?.url ?? "")
      expect(name).toMatch(/-logo\.svg$/)
      const stored = readFileSync(join(STATIC_DIR, name), "utf8")
      expect(stored).toContain('<rect width="5" height="5" fill="#c00"/>')
      expect(stored).toMatch(/width="20"/)
      expect(stored).not.toMatch(/script|alert|onload|onclick|evil\.example|<use/)
      expect([empty.status, empty.data.message]).toEqual([400, "upload.svg_invalid"])
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

    // Images only (adr/0061 C14 M4): nothing uploads a CSV here any more (Medusa's
    // product import is closed, F3.9; the catalog sheets read their own body)
    it("refuses a plain CSV and stores nothing", async () => {
      const before = storedFiles().length

      const response = await upload(
        form(["Product Handle,Title\nsef-bicagi,Şef Bıçağı\n", "Ürünler.csv", "text/csv"])
      )

      expect(response.status).toBe(400)
      expect(response.data.message).toBe("upload.unsupported_type")
      expect(storedFiles()).toHaveLength(before)
    })

    it("stores nothing when one file of several is refused", async () => {
      const before = storedFiles().length

      const response = await upload(
        form([PNG_1X1, "a.png", "image/png"], [EMPTY_SVG, "b.svg", "image/svg+xml"])
      )

      expect(response.status).toBe(400)
      expect(storedFiles()).toHaveLength(before)
    })
  },
})
