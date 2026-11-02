import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { PLATFORM_SETTINGS_MODULE } from "../../src/modules/platform-settings"
import type PlatformSettingsModuleService from "../../src/modules/platform-settings/service"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"

jest.setTimeout(180 * 1000)

interface TermView {
  id: string
  name: string
  handle: string
  path: string
}

interface Term extends TermView {
  kind: "category" | "tag"
  description: string | null
  rank: number
  post_count: number
  live_post_count: number
}

interface Entry {
  id: string
  path: string
  category_id: string | null
  tag_ids: string[]
  category: TermView | null
  tags: TermView[]
}

interface List {
  entries: { id: string; category: TermView | null; tags: TermView[] }[]
}

interface Answer {
  type: string
  entity_type?: string
  entity_id?: string
  seo?: {
    title: string
    description: string
    robots: string
    breadcrumbs: { name: string }[]
  } | null
}

interface Job {
  status: string
}

const doc = (text: string) => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
})

/** Blog categories and tags (adr/0019 ek 2026-11-03): CRUD, filing, Store API, URLs, sitemap. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: { headers: Record<string, string> }
    let store: Storefront

    const post = <T>(url: string, body: unknown) =>
      settle(http.post<T & { message?: string }>(url, body, { headers: admin.headers }))
    const term = (body: Record<string, unknown>, id?: string) =>
      post<{ term: Term }>(id ? `/admin/content/terms/${id}` : "/admin/content/terms", body)
    const entry = (body: Record<string, unknown>, id?: string) =>
      post<{ entry: Entry }>(id ? `/admin/content/${id}` : "/admin/content", body)
    const remove = (id: string) =>
      settle(
        http.delete<{ deleted: boolean; unlinked: number }>(`/admin/content/terms/${id}`, admin)
      )
    const storeGet = <T>(url: string) => settle(http.get<T>(url, { headers: store.headers }))
    const resolve = async (path: string) =>
      (await storeGet<Answer>(`/store/seo/resolve?path=${encodeURIComponent(path)}`)).data
    const settings = () =>
      getContainer().resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
    const livePost = async (title: string, terms: Record<string, unknown>) =>
      (await entry({ kind: "post", title, status: "published", body: doc(title), ...terms })).data
        .entry

    async function runSitemap(): Promise<Job> {
      const queued = await post<{ async_job: { id: string } }>("/admin/async-jobs", {
        type: "seo.sitemap",
        input: {},
      })
      for (let attempt = 0; attempt < 100; attempt++) {
        const { data } = await http.get<{ async_job: Job }>(
          `/admin/async-jobs/${queued.data.async_job.id}`,
          admin
        )
        if (data.async_job.status !== "queued" && data.async_job.status !== "running") {
          return data.async_job
        }
        await new Promise((done) => setTimeout(done, 100))
      }
      throw new Error("job did not finish")
    }

    beforeEach(async () => {
      admin = await createAdminUser(http, getContainer())
      store = await createStorefront(getContainer())
      await settings().saveSection("seo", { canonical_host: "magaza.example.com" }, null)
    })

    // The settings cache outlives the database reset between tests
    afterEach(async () => {
      await settings().saveSection("seo", { canonical_host: null }, null)
    })

    it("makes a term with its handle from its name, once per kind, and renames it", async () => {
      const made = await term({ kind: "category", name: "Bıçak Bakımı", description: "Bileme." })
      expect(made.status).toBe(201)
      expect(made.data.term).toMatchObject({
        kind: "category",
        handle: "bicak-bakimi",
        path: "/blog/kategori/bicak-bakimi",
        description: "Bileme.",
        post_count: 0,
      })
      const again = await term({ kind: "category", name: "Bıçak bakımı" })
      expect([again.status, again.data.message]).toEqual([400, "content.term_handle_taken"])
      // A tag of the same name is another kind's handle
      const tag = await term({ kind: "tag", name: "Bıçak Bakımı" })
      expect(tag.data.term.path).toBe("/blog/etiket/bicak-bakimi")

      const id = made.data.term.id
      const renamed = await term({ name: "Bakım" }, id)
      expect(renamed.data.term).toMatchObject({ name: "Bakım", handle: "bicak-bakimi" })
      const moved = await term({ handle: "bakim", rank: 2 }, id)
      expect(moved.data.term).toMatchObject({ path: "/blog/kategori/bakim", rank: 2 })
      // No live post ever showed there: the old path is freed, not redirected
      expect((await resolve("/blog/kategori/bicak-bakimi")).type).toBe("not_found")
      expect((await resolve("/blog/kategori/bakim")).type).toBe("entity")

      const list = await http.get<{ terms: Term[]; count: number }>(
        "/admin/content/terms?kind=category",
        admin
      )
      expect(list.data.terms.map((each) => each.id)).toEqual([id])
      expect(
        (await http.get<{ term: Term }>(`/admin/content/terms/${id}`, admin)).data.term
      ).toMatchObject({ id })
      expect((await settle(http.get(`/admin/content/terms/cterm_0NOPE`, admin))).status).toBe(404)
      // A post may not take the archives' prefixes
      const reserved = await entry({ kind: "post", title: "Kategori" })
      expect([reserved.status, reserved.data.message]).toEqual([400, "seo.path_reserved"])
    })

    it("files a post under one category and its tags, and the blog lists them", async () => {
      const knives = (await term({ kind: "category", name: "Bıçaklar" })).data.term
      const care = (await term({ kind: "category", name: "Bakım" })).data.term
      const steel = (await term({ kind: "tag", name: "Çelik" })).data.term
      const sharp = (await term({ kind: "tag", name: "Bileme" })).data.term

      const first = await livePost("Şef bıçağı seçimi", {
        category_id: knives.id,
        tag_ids: [steel.id, sharp.id],
      })
      expect(first).toMatchObject({
        category_id: knives.id,
        category: { id: knives.id, name: "Bıçaklar", path: "/blog/kategori/bicaklar" },
      })
      // The shop's order, then the name: Bileme before Çelik
      expect(first.tags.map((tag) => tag.name)).toEqual(["Bileme", "Çelik"])
      const second = await livePost("Bileme taşı", { category_id: care.id, tag_ids: [sharp.id] })
      await entry({ kind: "post", title: "Taslak yazı", category_id: knives.id })

      // One category: the new one replaces it, the tags stay
      const moved = await entry({ category_id: care.id }, first.id)
      expect(moved.data.entry).toMatchObject({ category_id: care.id })
      expect(moved.data.entry.tag_ids.sort()).toEqual([sharp.id, steel.id].sort())

      const wrong = await entry({ category_id: steel.id }, first.id)
      expect([wrong.status, wrong.data.message]).toEqual([400, "content.term_unknown"])
      const page = await entry({ kind: "page", title: "Hakkımızda", category_id: care.id })
      expect([page.status, page.data.message]).toEqual([400, "content.terms_post_only"])

      const ids = async (query: string) =>
        (await storeGet<List>(`/store/content?${query}`)).data.entries.map((each) => each.id).sort()
      expect(await ids("kind=post&category=bakim")).toEqual([first.id, second.id].sort())
      expect(await ids("kind=post&tag=celik")).toEqual([first.id])
      expect(await ids("category=bakim&tag=celik")).toEqual([first.id])
      // Only a draft is filed there; a handle that is no term lists nothing
      expect(await ids("kind=post&category=bicaklar")).toEqual([])
      expect(await ids("kind=post&tag=yok")).toEqual([])

      const terms = await storeGet<{ terms: (TermView & { post_count: number })[] }>(
        "/store/content/terms?kind=category"
      )
      expect(terms.data.terms.map(({ handle, post_count }) => [handle, post_count])).toEqual([
        ["bakim", 2],
      ])
      const tags = await storeGet<{ terms: (TermView & { post_count: number })[] }>(
        "/store/content/terms?kind=tag"
      )
      expect(tags.data.terms.map(({ handle, post_count }) => [handle, post_count])).toEqual([
        ["bileme", 2],
        ["celik", 1],
      ])

      const read = await storeGet<{ entry: Entry }>(`/store/content/${first.id}`)
      expect(read.data.entry.category).toEqual({
        id: care.id,
        name: "Bakım",
        handle: "bakim",
        path: "/blog/kategori/bakim",
      })
      expect(read.data.entry.tags.map((tag) => tag.handle)).toEqual(["bileme", "celik"])

      const filed = await http.get<{ entries: { id: string }[] }>(
        `/admin/content?term_id=${sharp.id}`,
        admin
      )
      expect(filed.data.entries.map((each) => each.id).sort()).toEqual([first.id, second.id].sort())
      const counted = await http.get<{ term: Term }>(`/admin/content/terms/${knives.id}`, admin)
      expect(counted.data.term).toMatchObject({ post_count: 1, live_post_count: 0 })
    })

    it("answers an archive with its seo object, noindex while empty, and maps the live ones", async () => {
      const care = (
        await term({
          kind: "category",
          name: "Bakım",
          description: "Bıçağınızı uzun ömürlü kılın.",
        })
      ).data.term
      const steel = (await term({ kind: "tag", name: "Çelik" })).data.term
      const empty = (await term({ kind: "tag", name: "Boş" })).data.term
      await livePost("Paslanmaz çelik nedir", { category_id: care.id, tag_ids: [steel.id] })

      const category = await resolve("/blog/kategori/bakim")
      expect(category).toMatchObject({
        type: "entity",
        entity_type: "post_category",
        entity_id: care.id,
      })
      expect(category.seo?.title.startsWith("Bakım |")).toBe(true)
      expect(category.seo?.description).toBe("Bıçağınızı uzun ömürlü kılın.")
      expect(category.seo?.robots).toBe("index,follow")
      expect(category.seo?.breadcrumbs.map((crumb) => crumb.name)).toEqual(["Blog", "Bakım"])

      const tag = await resolve("/blog/etiket/celik")
      expect(tag).toMatchObject({ entity_type: "post_tag", entity_id: steel.id })
      expect(tag.seo?.description).toContain("Paslanmaz çelik nedir")
      expect((await resolve(empty.path)).seo?.robots).toBe("noindex,follow")

      // Its own SEO fields, through the shared SEO route
      const own = await settle(
        http.put(
          `/admin/seo/post_category/${care.id}`,
          { seo_title: "Bıçak bakımı rehberi" },
          admin
        )
      )
      expect(own.status).toBe(200)
      expect((await resolve("/blog/kategori/bakim")).seo?.title).toBe("Bıçak bakımı rehberi")

      expect(await runSitemap()).toMatchObject({ status: "succeeded" })
      const blog = await storeGet<string>("/store/seo/sitemaps/sitemap-blog-1.xml")
      expect(blog.data).toContain("<loc>https://magaza.example.com/blog/kategori/bakim</loc>")
      expect(blog.data).toContain("<loc>https://magaza.example.com/blog/etiket/celik</loc>")
      expect(blog.data).not.toContain("/blog/etiket/bos")
    })

    it("takes a deleted category or tag off its posts, never refusing it", async () => {
      const care = (await term({ kind: "category", name: "Bakım" })).data.term
      const steel = (await term({ kind: "tag", name: "Çelik" })).data.term
      const unused = (await term({ kind: "category", name: "Yeni" })).data.term
      const article = await livePost("Bileme", { category_id: care.id, tag_ids: [steel.id] })

      const gone = await remove(care.id)
      expect(gone.status).toBe(200)
      expect(gone.data).toMatchObject({ deleted: true, unlinked: 1 })
      const read = await storeGet<{ entry: Entry }>(`/store/content/${article.id}`)
      expect(read.data.entry.category).toBeNull()
      expect(read.data.entry.tags.map((tag) => tag.id)).toEqual([steel.id])
      // It showed a live post: its archive answers 410
      expect((await resolve("/blog/kategori/bakim")).type).toBe("gone")

      expect((await remove(steel.id)).data.unlinked).toBe(1)
      expect(
        (await storeGet<{ entry: Entry }>(`/store/content/${article.id}`)).data.entry.tags
      ).toEqual([])
      expect((await settle(http.get(`/admin/content/terms/${steel.id}`, admin))).status).toBe(404)

      // An archive that never showed a post gives its path back: the term can be made again
      await remove(unused.id)
      expect((await resolve("/blog/kategori/yeni")).type).toBe("not_found")
      expect((await term({ kind: "category", name: "Yeni" })).status).toBe(201)
    })
  },
})
