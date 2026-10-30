import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { MIGRATION_MODULE } from "../../src/modules/migration"
import type MigrationModuleService from "../../src/modules/migration/service"
import { SEO_REDIRECTS_MODULE } from "../../src/modules/seo-redirects"
import type SeoRedirectsModuleService from "../../src/modules/seo-redirects/service"
import { oldAddressOf } from "../../src/lib/migration/addresses"
import { watchNotFound } from "../../src/workflows/migration/watch"
import { bundle, fileOf } from "../fixtures/migration-bundle"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { sheetClient } from "../helpers/sheets"
import type { SheetJob } from "../helpers/sheets"
import { stockShop } from "../helpers/stock"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"

jest.setTimeout(600 * 1000)

interface Address {
  id: string
  address: string
  action: string
  state: string
  outcome: string | null
}

interface Summary {
  ready: boolean
  undecided: number
  top: { checked: number; unanswered: { address: string }[] }
}

/** F14.7 (adr/0042 §8; KK3): the old site's addresses kept, decided and applied before cutover. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let owner: Awaited<ReturnType<typeof createAdminUser>>
    let store: Storefront
    const { settled } = sheetClient(http, getContainer, () => owner.headers)
    const migration = () => getContainer().resolve<MigrationModuleService>(MIGRATION_MODULE)

    const get = async <T>(path: string) =>
      (await http.get<T>(path, { headers: owner.headers })).data
    const post = <T>(path: string, body: unknown, headers = owner.headers) =>
      settle(http.post<T & { message?: string }>(path, body, { headers }))
    const addresses = async () =>
      (await get<{ urls: Address[] }>("/admin/migrations/urls?filter=all")).urls
    const byAddress = async (address: string) =>
      (await addresses()).find((row) => row.address === address)
    const resolve = async (path: string) =>
      (
        await http.get<{ type: string; location?: string }>(
          `/store/seo/resolve?path=${encodeURIComponent(path)}`,
          { headers: store.headers }
        )
      ).data

    beforeEach(async () => {
      owner = await createAdminUser(http, getContainer())
      store = await createStorefront(getContainer())
      await stockShop(getContainer())
    })

    it("keeps moved records' old paths, applies the owner's 301s and 410s, and says when cutover is ready", async () => {
      const moved = await settle(
        http.post<{ async_job: SheetJob }>("/admin/migrations?mode=apply", fileOf(bundle), {
          headers: { ...owner.headers, "content-type": "application/json" },
        })
      )
      expect((await settled(moved.data.async_job.id)).status).toBe("succeeded")
      // Search Console's top pages, as F14.7's import adds them
      await migration().addUrls(
        [
          ["/urun/dokum-tava", 900],
          ["/eski-kampanya", 500],
          ["/urun.php?id=12", 50],
        ].map(([raw, clicks]) => ({
          ...(oldAddressOf(String(raw)) ?? { address: "", path: "", query: null }),
          origin: "search_console" as const,
          clicks: Number(clicks),
        }))
      )

      expect(await byAddress("/urun/dokum-tava")).toMatchObject({
        action: "reserve",
        state: "not_found",
      })
      expect(await byAddress("/kategori/tavalar")).toMatchObject({ action: "reserve" })
      // The brand's old path is its path here too: it answers already
      expect(await byAddress("/marka/demirci")).toMatchObject({ action: "covered", state: "live" })
      expect(await byAddress("/hakkimizda")).toMatchObject({ action: "undecided" })
      expect(await byAddress("/urun.php?id=12")).toMatchObject({ action: "unsupported" })
      const before = (await get<{ summary: Summary }>("/admin/migrations/urls/summary")).summary
      expect(before.ready).toBe(false)
      expect(before.top.unanswered.map((row) => row.address)).toEqual([
        "/urun/dokum-tava",
        "/eski-kampanya",
        "/urun.php?id=12",
      ])

      const decide = async (address: string, body: Record<string, unknown>) =>
        post(`/admin/migrations/urls/${(await byAddress(address))?.id ?? ""}/decision`, body)
      expect(
        (await decide("/eski-kampanya", { decision: "redirect", target: "/yok-boyle" })).status
      ).toBe(400)
      expect(
        (
          await decide("/eski-kampanya", {
            decision: "redirect",
            target: "/urun/tasinan-dokum-tava",
          })
        ).status
      ).toBe(200)
      expect((await decide("/hakkimizda", { decision: "gone" })).status).toBe(200)
      // A server rule must take a query address: the owner's word marks it seen
      expect((await decide("/urun.php?id=12", { decision: "gone" })).status).toBe(200)

      // A record's old path that is the home page is never kept for it
      const [movedProduct] = await migration().listMigrationItems({
        kind: "product",
        status: "done",
      })
      await migration().addUrls([
        {
          address: "/",
          path: "/",
          query: null,
          origin: "source",
          entity_type: "product",
          entity_id: movedProduct?.target_id ?? "",
        },
      ])
      expect((await post("/admin/migrations/urls/apply", {}, owner.plain)).status).toBe(428)
      const queued = await post<{ async_job: SheetJob }>("/admin/migrations/urls/apply", {})
      expect(queued.status).toBe(202)
      const job = await settled(queued.data.async_job.id)
      expect(job.status).toBe("succeeded")
      expect((job.result_summary as { counts: Record<string, number> }).counts).toMatchObject({
        reserve: 3,
        redirect: 1,
        gone: 1,
        unsupported: 1,
        taken: 0,
        // The home page, refused for a record
        refused: 1,
      })

      // The old product path follows its record; the owner's rules answer
      expect(await resolve("/urun/dokum-tava")).toMatchObject({
        type: "redirect",
        location: "/urun/tasinan-dokum-tava",
      })
      expect(await resolve("/eski-kampanya")).toMatchObject({
        type: "redirect",
        location: "/urun/tasinan-dokum-tava",
      })
      expect(await resolve("/hakkimizda")).toMatchObject({ type: "gone" })
      const rules = await getContainer()
        .resolve<SeoRedirectsModuleService>(SEO_REDIRECTS_MODULE)
        .listSeoRedirects({ origin: "migration" })
      expect(rules.map((rule) => [rule.source, rule.status]).sort()).toEqual([
        ["/eski-kampanya", 301],
        ["/hakkimizda", 410],
      ])
      expect(await byAddress("/urun/dokum-tava")).toMatchObject({
        outcome: "reserved",
        action: "covered",
      })
      const root = (await migration().listMigrationUrls({ address: "/" }))[0]
      expect(root?.outcome).toBe("migration.url_path_reserved")

      const after = (await get<{ summary: Summary }>("/admin/migrations/urls/summary")).summary
      expect(after).toMatchObject({
        ready: true,
        undecided: 0,
        top: { checked: 3, unanswered: [] },
      })

      // Applied again, nothing new: every address answers now but the home page, refused again
      const again = await post<{ async_job: SheetJob }>("/admin/migrations/urls/apply", {})
      const second = await settled(again.data.async_job.id)
      expect((second.result_summary as { counts: Record<string, number> }).counts).toMatchObject({
        reserve: 1,
        redirect: 0,
        refused: 1,
      })
    })

    it("watches the storefront's 404s for thirty days after cutover, ringing the bell", async () => {
      const marked = await post<{ cutover: { cutover_at: string; watch_until: string } }>(
        "/admin/migrations/cutover",
        {}
      )
      expect(marked.status).toBe(200)
      const at = new Date(marked.data.cutover.cutover_at)
      expect(new Date(marked.data.cutover.watch_until).getTime() - at.getTime()).toBe(
        30 * 24 * 60 * 60 * 1000
      )
      await migration().addUrls([
        { address: "/products/eski", path: "/products/eski", query: null, origin: "sitemap" },
      ])
      const later = new Date(at.getTime() + 60_000)
      await getContainer()
        .resolve<SeoRedirectsModuleService>(SEO_REDIRECTS_MODULE)
        .createSeoNotFounds(
          ["/products/eski", "/hic-bilinmeyen"].map((path) => ({
            path,
            hits: 3,
            first_seen_at: later,
            last_seen_at: later,
          }))
        )

      const tomorrow = new Date(at.getTime() + 24 * 60 * 60 * 1000)
      expect(await watchNotFound(getContainer(), tomorrow)).toEqual({ paths: 2, known: 1 })
      const found = await migration().listMigrationUrls({ address: "/hic-bilinmeyen" })
      expect(found[0]?.origins).toEqual(["not_found"])
      const bells = async () =>
        (
          await getContainer()
            .resolve(ContainerRegistrationKeys.QUERY)
            .graph({
              entity: "notification",
              fields: ["data"],
              filters: { trigger_type: "migration.not_found_seen" },
            })
        ).data as unknown as { data: { kind: string; count: number; known: number } }[]
      expect((await bells()).map((bell) => bell.data)).toMatchObject([
        { kind: "migration_not_found", count: 2, known: 1 },
      ])

      // Nothing new since the last look: no bell; past the thirty days: no look
      expect(await watchNotFound(getContainer(), new Date(tomorrow.getTime() + 60_000))).toEqual({
        paths: 0,
        known: 0,
      })
      expect(await bells()).toHaveLength(1)
      expect(
        await watchNotFound(getContainer(), new Date(at.getTime() + 31 * 24 * 60 * 60 * 1000))
      ).toBeNull()
    })
  },
})
