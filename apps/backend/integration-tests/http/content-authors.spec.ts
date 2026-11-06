import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { Modules } from "@medusajs/framework/utils"
import { CONTENT_MODULE } from "../../src/modules/content"
import type ContentModuleService from "../../src/modules/content/service"
import { MEDIA_MODULE } from "../../src/modules/media"
import type MediaModuleService from "../../src/modules/media/service"
import { PLATFORM_SETTINGS_MODULE } from "../../src/modules/platform-settings"
import type PlatformSettingsModuleService from "../../src/modules/platform-settings/service"
import { backfillAuthors } from "../../src/workflows/content/author-backfill"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"

jest.setTimeout(180 * 1000)

interface Author {
  id: string
  name: string
  handle: string
  path: string
  job_title: string | null
  bio: string | null
  image_url: string | null
  linkedin_url: string | null
  user_id: string | null
  user: { id: string; email: string } | null
  post_count: number
  live_post_count: number
}

interface Entry {
  id: string
  handle: string
  author_id: string | null
  author_name: string | null
  author: { id: string; name: string; path: string } | null
}

interface Answer {
  type: string
  status?: number
  location?: string
  entity_type?: string
  entity_id?: string
  seo?: {
    title: string
    description: string
    robots: string
    breadcrumbs: { name: string }[]
    jsonLd: Record<string, unknown>[]
  } | null
}

const PHOTO = "https://cdn.example.com/content/ayse.webp"

const doc = (text: string) => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
})

/** Blog authors (adr/0060): CRUD, slug/301, a post's author, Store API, JSON-LD, sitemap, backfill. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: { headers: Record<string, string> }
    let store: Storefront

    const post = <T>(url: string, body: unknown) =>
      settle(http.post<T & { message?: string }>(url, body, { headers: admin.headers }))
    const author = (body: Record<string, unknown>, id?: string) =>
      post<{ author: Author }>(id ? `/admin/content/authors/${id}` : "/admin/content/authors", body)
    const entry = (body: Record<string, unknown>, id?: string) =>
      post<{ entry: Entry }>(id ? `/admin/content/${id}` : "/admin/content", body)
    const storeGet = <T>(url: string) => settle(http.get<T>(url, { headers: store.headers }))
    const resolve = async (path: string) =>
      (await storeGet<Answer>(`/store/seo/resolve?path=${encodeURIComponent(path)}`)).data
    const settings = () =>
      getContainer().resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
    const livePost = async (title: string, extra: Record<string, unknown> = {}) =>
      (await entry({ kind: "post", title, status: "published", body: doc(title), ...extra })).data
        .entry

    async function runSitemap(): Promise<void> {
      const queued = await post<{ async_job: { id: string } }>("/admin/async-jobs", {
        type: "seo.sitemap",
        input: {},
      })
      for (let attempt = 0; attempt < 100; attempt++) {
        const { data } = await http.get<{ async_job: { status: string } }>(
          `/admin/async-jobs/${queued.data.async_job.id}`,
          admin
        )
        if (data.async_job.status === "succeeded") {
          return
        }
        if (data.async_job.status !== "queued" && data.async_job.status !== "running") {
          throw new Error(`sitemap job ${data.async_job.status}`)
        }
        await new Promise((done) => setTimeout(done, 100))
      }
      throw new Error("job did not finish")
    }

    beforeEach(async () => {
      const container = getContainer()
      admin = await createAdminUser(http, container)
      store = await createStorefront(container)
      await container
        .resolve<MediaModuleService>(MEDIA_MODULE)
        .createMediaAssets([{ url: PHOTO, file_id: "author-test-photo", width: 400, height: 400 }])
      await settings().saveSection("seo", { canonical_host: "magaza.example.com" }, null)
    })

    // The settings cache outlives the database reset between tests
    afterEach(async () => {
      await settings().saveSection("seo", { canonical_host: null }, null)
    })

    it("makes an author with a handle from the name, checks the fields, renames them", async () => {
      const [user] = await getContainer()
        .resolve(Modules.USER)
        .listUsers({}, { select: ["id"], take: 1 })
      const made = await author({
        name: "Ayşe Yılmaz",
        job_title: "Bıçak ustası",
        bio: "Yirmi yıldır bıçak biliyor.\n\nAtölyede yazıyor.",
        image_url: PHOTO,
        linkedin_url: "https://www.linkedin.com/in/ayse",
        user_id: user?.id,
      })
      expect(made.status).toBe(201)
      expect(made.data.author).toMatchObject({
        handle: "ayse-yilmaz",
        path: "/blog/yazar/ayse-yilmaz",
        job_title: "Bıçak ustası",
        image_url: PHOTO,
        user_id: user?.id,
        user: { id: user?.id },
        post_count: 0,
      })
      // The same name takes the next free handle; one typed and taken is refused
      const twin = await author({ name: "Ayşe  Yılmaz" })
      expect(twin.data.author.handle).toBe("ayse-yilmaz-2")
      const typed = await author({ name: "Başka", handle: "ayse-yilmaz" })
      expect([typed.status, typed.data.message]).toEqual([400, "content.author_handle_taken"])

      const badLink = await author({ name: "X", x_url: "https://ornek.com/ayse" })
      expect([badLink.status, badLink.data.message]).toEqual([400, "content.author_link_invalid"])
      const badPhoto = await author({ name: "Y", image_url: "https://evil.example/x.png" })
      expect([badPhoto.status, badPhoto.data.message]).toEqual([400, "content.image_unknown"])
      const badUser = await author({ name: "Z", user_id: "user_0NOPE" })
      expect([badUser.status, badUser.data.message]).toEqual([400, "content.author_user_unknown"])

      const id = made.data.author.id
      const renamed = await author({ name: "Ayşe Y.", linkedin_url: null }, id)
      expect(renamed.data.author).toMatchObject({ name: "Ayşe Y.", handle: "ayse-yilmaz" })
      expect(renamed.data.author.linkedin_url).toBeNull()
      const list = await http.get<{ authors: Author[]; count: number }>(
        "/admin/content/authors?q=ayşe",
        admin
      )
      expect(list.data.count).toBe(2)
      expect((await settle(http.get("/admin/content/authors/cauth_0NOPE", admin))).status).toBe(404)
      // `/blog/yazar` is the authors' prefix: no post takes it as its handle
      const titled = await entry({ kind: "post", title: "Yazar" })
      expect(titled.data.entry.handle).toBe("yazar-2")
    })

    it("names a post's author, lists their posts and answers their page", async () => {
      const ayse = (
        await author({
          name: "Ayşe Yılmaz",
          job_title: "Bıçak ustası",
          bio: "Yirmi yıldır bıçak biliyor.",
          image_url: PHOTO,
          x_url: "https://x.com/ayse",
        })
      ).data.author
      const first = await livePost("Bıçak nasıl bilenir", { author_id: ayse.id })
      expect(first).toMatchObject({
        author_id: ayse.id,
        author: { id: ayse.id, name: "Ayşe Yılmaz", path: "/blog/yazar/ayse-yilmaz" },
      })
      const other = await livePost("Çelik türleri", { author_name: "Eski Yazar" })
      await entry({ kind: "post", title: "Taslak", author_id: ayse.id })

      const page = await entry({ kind: "page", title: "Hakkımızda", author_id: ayse.id })
      expect([page.status, page.data.message]).toEqual([400, "content.author_post_only"])
      const unknown = await entry({ author_id: "cauth_0NOPE" }, other.id)
      expect([unknown.status, unknown.data.message]).toEqual([400, "content.author_unknown"])

      const listed = await storeGet<{ entries: (Entry & { id: string })[]; count: number }>(
        "/store/content?kind=post&author=ayse-yilmaz"
      )
      expect(listed.data.entries.map((each) => each.id)).toEqual([first.id])
      expect(listed.data.entries[0]).toMatchObject({
        author_name: "Ayşe Yılmaz",
        author: { id: ayse.id, handle: "ayse-yilmaz", job_title: "Bıçak ustası" },
      })
      expect((await storeGet<{ count: number }>("/store/content?author=yok")).data.count).toBe(0)

      // A post with the old text alone keeps it, with no author record
      const old = await storeGet<{ entry: Entry }>(`/store/content/${other.id}`)
      expect(old.data.entry).toMatchObject({ author: null, author_name: "Eski Yazar" })
      const read = await storeGet<{ entry: Record<string, unknown> }>(`/store/content/${first.id}`)
      expect(read.data.entry["author"]).toMatchObject({
        name: "Ayşe Yılmaz",
        bio: "Yirmi yıldır bıçak biliyor.",
        image_url: PHOTO,
        image_width: 400,
        links: [{ kind: "x", url: "https://x.com/ayse" }],
      })
      expect(read.data.entry["author"]).not.toHaveProperty("user_id")

      const profile = await storeGet<{ author: Record<string, unknown> }>(
        `/store/content/authors/${ayse.id}`
      )
      expect(profile.data.author).toMatchObject({ handle: "ayse-yilmaz", post_count: 1 })

      // The post's structured data names the Person, with their page
      const article = (await resolve("/blog/bicak-nasil-bilenir")).seo?.jsonLd[0]
      expect(article?.["author"]).toMatchObject({
        "@type": "Person",
        name: "Ayşe Yılmaz",
        url: "https://magaza.example.com/blog/yazar/ayse-yilmaz",
        jobTitle: "Bıçak ustası",
        image: PHOTO,
        sameAs: ["https://x.com/ayse"],
      })

      const answer = await resolve("/blog/yazar/ayse-yilmaz")
      expect(answer).toMatchObject({
        type: "entity",
        entity_type: "post_author",
        entity_id: ayse.id,
      })
      expect(answer.seo?.title.startsWith("Ayşe Yılmaz |")).toBe(true)
      expect(answer.seo?.description).toBe("Yirmi yıldır bıçak biliyor.")
      expect(answer.seo?.robots).toBe("index,follow")
      expect(answer.seo?.breadcrumbs.map((crumb) => crumb.name)).toEqual(["Blog", "Ayşe Yılmaz"])
      expect(answer.seo?.jsonLd[0]).toMatchObject({
        "@type": "ProfilePage",
        url: "https://magaza.example.com/blog/yazar/ayse-yilmaz",
        mainEntity: { "@type": "Person", name: "Ayşe Yılmaz", sameAs: ["https://x.com/ayse"] },
      })

      const counted = await http.get<{ author: Author }>(`/admin/content/authors/${ayse.id}`, admin)
      expect(counted.data.author).toMatchObject({ post_count: 2, live_post_count: 1 })
    })

    it("keeps an author with no live post out of search and the sitemap", async () => {
      const empty = (await author({ name: "Boş Yazar" })).data.author
      const busy = (await author({ name: "Mehmet Usta" })).data.author
      await livePost("Sap seçimi", { author_id: busy.id })
      expect((await resolve(empty.path)).seo?.robots).toBe("noindex,follow")
      expect((await resolve(busy.path)).seo?.description).toContain("Sap seçimi")

      await runSitemap()
      const blog = await storeGet<string>("/store/seo/sitemaps/sitemap-blog-1.xml")
      expect(blog.data).toContain("<loc>https://magaza.example.com/blog/yazar/mehmet-usta</loc>")
      expect(blog.data).not.toContain("/blog/yazar/bos-yazar")

      // Its own SEO fields, through the shared SEO route
      const own = await settle(
        http.put(`/admin/seo/post_author/${busy.id}`, { seo_title: "Mehmet Usta kimdir" }, admin)
      )
      expect(own.status).toBe(200)
      expect((await resolve(busy.path)).seo?.title).toBe("Mehmet Usta kimdir")
    })

    it("redirects a live author's old page, and answers 410 once they are deleted", async () => {
      const ayse = (await author({ name: "Ayşe Yılmaz" })).data.author
      const quiet = (await author({ name: "Sessiz" })).data.author
      const article = await livePost("Bileme", { author_id: ayse.id })

      await author({ handle: "ayse" }, ayse.id)
      expect(await resolve("/blog/yazar/ayse-yilmaz")).toMatchObject({
        type: "redirect",
        status: 301,
        location: "/blog/yazar/ayse",
      })
      // One who never had a live post frees the old path
      await author({ handle: "sessiz-yazar" }, quiet.id)
      expect((await resolve("/blog/yazar/sessiz")).type).toBe("not_found")

      const gone = await settle(
        http.delete<{ deleted: boolean; unlinked: number }>(
          `/admin/content/authors/${ayse.id}`,
          admin
        )
      )
      expect(gone.data).toMatchObject({ deleted: true, unlinked: 1 })
      expect((await resolve("/blog/yazar/ayse")).type).toBe("gone")
      const read = await storeGet<{ entry: Entry }>(`/store/content/${article.id}`)
      expect(read.data.entry.author).toBeNull()
      await settle(http.delete(`/admin/content/authors/${quiet.id}`, admin))
      expect((await resolve("/blog/yazar/sessiz-yazar")).type).toBe("not_found")
    })

    it("backfills authors from the old free text: a dry run first, then once", async () => {
      const existing = (await author({ name: "Ayşe Yılmaz" })).data.author
      const a = await livePost("Bir", { author_name: "ayşe  yılmaz" })
      const b = await livePost("İki", { author_name: "Mehmet Usta" })
      const c = await livePost("Üç", { author_name: "Mehmet Usta " })
      const none = await livePost("Dört")
      const container = getContainer()

      const dry = await backfillAuthors(container, { apply: false })
      expect(dry).toMatchObject({ posts: 3, names: 2, reused: 1, created: 0, linked: 0 })
      const service = container.resolve<ContentModuleService>(CONTENT_MODULE)
      expect(await service.listContentAuthors({}, { select: ["id"] })).toHaveLength(1)

      const done = await backfillAuthors(container, { apply: true })
      expect(done).toMatchObject({ created: 1, linked: 3, problems: [] })
      const posts = await service.listContentEntries(
        { id: [a.id, b.id, c.id, none.id] },
        { select: ["id", "author_id", "author_name"] }
      )
      const byId = new Map(posts.map((each) => [each.id, each]))
      expect(byId.get(a.id)?.author_id).toBe(existing.id)
      expect(byId.get(b.id)?.author_id).toBe(byId.get(c.id)?.author_id)
      // The old text stays as it was, the fallback until a later cleanup
      expect(byId.get(b.id)?.author_name).toBe("Mehmet Usta")
      expect(byId.get(none.id)?.author_id).toBeNull()
      expect((await resolve("/blog/yazar/mehmet-usta")).entity_type).toBe("post_author")

      expect(await backfillAuthors(container, { apply: true })).toMatchObject({
        posts: 0,
        created: 0,
        linked: 0,
      })
    })
  },
})
