import { createServer } from "node:http"
import type { Server } from "node:http"
import type { AddressInfo } from "node:net"
import type { MedusaContainer } from "@medusajs/framework/types"
import sharp from "sharp"
import { wxrFixture } from "../../src/lib/migration/sources/wordpress/__tests__/wxr"
import { createAdminUser } from "./admin"
import type { HttpClient } from "./http"
import { settle } from "./http"
import { sheetClient } from "./sheets"
import type { SheetJob } from "./sheets"
import { stockShop } from "./stock"

/**
 * The WordPress + WooCommerce move's suites (adr/0042 Ek 2026-11-03): the
 * old site serving its media library's pictures (a fake origin reached
 * directly), the shop's owner, a stocked shop, and the export (WXR) sent
 * in to check or apply. Registers its own hooks; call it in `testSuite`.
 */

export type Counts = Record<string, Record<string, number>>

type Owner = Awaited<ReturnType<typeof createAdminUser>>

export function wordpressFixture(http: HttpClient, getContainer: () => MedusaContainer) {
  let owner: Owner | undefined
  let server: Server | undefined
  const state = { site: "", pictures: [] as string[] }
  const headers = () => {
    if (!owner) {
      throw new Error("wordpress fixture: no owner yet")
    }
    return owner.headers
  }
  const { settled, fileBytes } = sheetClient(http, getContainer, headers)

  const start = (body: Buffer, query: string, type = "application/xml") =>
    settle(
      http.post<{ async_job: SheetJob; message?: string }>(
        `/admin/migrations?source=wordpress&${query}`,
        body,
        { headers: { ...headers(), "content-type": type } }
      )
    )
  const run = async (mode: "check" | "apply") => {
    const queued = await start(Buffer.from(wxrFixture(state.site)), `mode=${mode}`)
    expect(queued.status).toBe(202)
    const job = await settled(queued.data.async_job.id)
    expect(job.status).toBe("succeeded")
    return { job, counts: (job.result_summary as { counts: Counts }).counts }
  }
  /** The shop's template with a field for one of the export's attributes (a product's own `malzeme`). */
  const makeTemplate = async () => {
    const template = await http.post<{ attribute_template: { id: string } }>(
      "/admin/attribute-templates",
      {
        name: "Ev eşyası",
        handle: "ev-esyasi",
        definitions: [
          {
            key: "malzeme",
            label: "Malzeme",
            type: "multi_select",
            options: [
              { value: "kayin", label: "Kayın" },
              { value: "ceviz", label: "Ceviz" },
            ],
          },
        ],
      },
      { headers: headers() }
    )
    expect(template.status).toBe(200)
  }

  beforeAll(async () => {
    const png = await sharp({
      create: { width: 40, height: 40, channels: 3, background: "#b03a2e" },
    })
      .png()
      .toBuffer()
    server = createServer((req, res) => {
      const path = req.url ?? ""
      if (path.startsWith("/wp-content/uploads/") && path.endsWith(".png")) {
        state.pictures.push(path.split("/").pop() ?? "")
        res.writeHead(200, { "content-type": "image/png" })
        res.end(png)
        return
      }
      res.writeHead(404)
      res.end()
    })
    const listening = server
    await new Promise<void>((resolve) => listening.listen(0, "127.0.0.1", resolve))
    state.site = `http://127.0.0.1:${String((listening.address() as AddressInfo).port)}`
    process.env["SHOPIFY_BASE_URL"] = state.site
  })

  afterAll(async () => {
    Reflect.deleteProperty(process.env, "SHOPIFY_BASE_URL")
    await new Promise((resolve) => server?.close(resolve))
  })

  beforeEach(async () => {
    owner = await createAdminUser(http, getContainer())
    await stockShop(getContainer())
  })

  return {
    /** The old site's origin, once it listens. */
    site: () => state.site,
    /** The pictures the old site served, by file name, in order. */
    pictures: state.pictures,
    /** The owner's headers, for the suite's own admin calls. */
    headers,
    start,
    run,
    settled,
    fileBytes,
    makeTemplate,
  }
}
