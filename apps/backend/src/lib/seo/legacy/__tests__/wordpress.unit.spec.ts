import { parseRequestPath } from "../../redirects"
import { keptQuery, wordpressAddress } from "../wordpress"

const addressOf = (raw: string) => {
  const request = parseRequestPath(raw)
  if (!request) {
    throw new Error(`not a path: ${raw}`)
  }
  return wordpressAddress(request)
}

const pagedOf = (raw: string) => {
  const address = addressOf(raw)
  return address?.kind === "paged"
    ? { base: address.base.path, query: address.base.query.toString(), page: address.page }
    : address
}

describe("WordPress addresses (adr/0059)", () => {
  it("reads a numbered page as its list and its page, from the path or the query", () => {
    expect(pagedOf("/urun-kategori/bicaklar/page/2/")).toEqual({
      base: "/urun-kategori/bicaklar",
      query: "",
      page: 2,
    })
    expect(pagedOf("/blog/page/3")).toEqual({ base: "/blog", query: "", page: 3 })
    expect(pagedOf("/page/2/")).toEqual({ base: "/", query: "", page: 2 })
    expect(pagedOf("/?paged=4")).toEqual({ base: "/", query: "", page: 4 })
    expect(pagedOf("/magaza?product-page=2&utm_source=x")).toEqual({
      base: "/magaza",
      query: "utm_source=x",
      page: 2,
    })
    // WordPress's own parameters go with the page; the visitor's stay
    expect(pagedOf("/x/page/2?orderby=price&filter_renk=mavi&gclid=1")).toEqual({
      base: "/x",
      query: "gclid=1",
      page: 2,
    })
    // A comment page is its post
    expect(pagedOf("/tava-bakimi/comment-page-2")).toEqual({
      base: "/tava-bakimi",
      query: "",
      page: 1,
    })
  })

  it("never takes a page number that is none", () => {
    for (const raw of ["/x/page/0", "/x/page/abc", "/x/page/123456", "/?paged=0", "/?paged=x"]) {
      expect(addressOf(raw)?.kind).not.toBe("paged")
    }
    // `/page/x` alone is an ordinary path (a page named "page" has its own)
    expect(addressOf("/page")).toBeNull()
  })

  it("sends date and author archives to the blog", () => {
    for (const raw of [
      "/2024",
      "/2024/05/",
      "/2024/05/12",
      "/author/deniz/",
      "/?m=202405",
      "/?author=2",
      "/?cat=7",
    ]) {
      expect(addressOf(raw)).toEqual({ kind: "page", path: "/blog" })
    }
    // Not a date: a post under a date permalink is its own record's, a slug of digits a page's
    for (const raw of ["/2024/05/tava-bakimi", "/2024/13", "/1850", "/2024/05/12/x"]) {
      expect(addressOf(raw)).toBeNull()
    }
  })

  it("reads tag and category archives", () => {
    expect(addressOf("/urun-etiketi/dokum-tava/")).toEqual({
      kind: "product_tag",
      slug: "dokum-tava",
    })
    expect(addressOf("/product-tag/cast-iron")).toEqual({ kind: "product_tag", slug: "cast-iron" })
    expect(addressOf("/?product_tag=celik")).toEqual({ kind: "product_tag", slug: "celik" })
    expect(addressOf("/tag/bakim")).toEqual({ kind: "post_term", taxonomy: "tag", slug: "bakim" })
    expect(addressOf("/etiket/%C3%A7elik")).toEqual({
      kind: "post_term",
      taxonomy: "tag",
      slug: "çelik",
    })
    expect(addressOf("/?tag=bakim")).toEqual({ kind: "post_term", taxonomy: "tag", slug: "bakim" })
    expect(addressOf("/category/rehberler/bakim")).toEqual({
      kind: "post_term",
      taxonomy: "category",
      slug: "bakim",
    })
    expect(addressOf("/tag/a/b")).toBeNull()
  })

  it("reads the home page's record, slug and search queries", () => {
    expect(addressOf("/?p=40")).toEqual({
      kind: "record_id",
      keys: ["post:40", "product:40", "page:40"],
    })
    expect(addressOf("/?post_type=product&p=31")).toEqual({
      kind: "record_id",
      keys: ["product:31"],
    })
    expect(addressOf("/index.php?page_id=7")).toEqual({ kind: "record_id", keys: ["page:7"] })
    expect(addressOf("/?product=dokum-tava")).toEqual({ kind: "product_slug", slug: "dokum-tava" })
    expect(addressOf("/?post_type=product&name=dokum-tava")).toEqual({
      kind: "product_slug",
      slug: "dokum-tava",
    })
    expect(addressOf("/?product_cat=tavalar")).toEqual({ kind: "category_slug", slug: "tavalar" })
    expect(addressOf("/?s=d%C3%B6k%C3%BCm+tava")).toEqual({ kind: "search", text: "döküm tava" })
    expect(addressOf("/?post_type=product")).toEqual({ kind: "page", path: "/magaza" })
    expect(addressOf("/index.php")).toEqual({ kind: "page", path: "/" })
    // An id that is none, a query WordPress never read: nothing of WordPress's
    expect(addressOf("/?p=abc")).toBeNull()
    expect(addressOf("/?utm_source=x")).toBeNull()
    expect(addressOf("/")).toBeNull()
  })

  it("names the media library's files and WordPress's machinery", () => {
    expect(addressOf("/wp-content/uploads/2024/05/Kapak-300x200.JPG")).toEqual({
      kind: "upload",
      path: "/wp-content/uploads/2024/05/kapak-300x200.jpg",
    })
    for (const raw of [
      "/wp-login.php",
      "/xmlrpc.php",
      "/wp-cron.php",
      "/wp-admin/",
      "/wp-admin/admin-ajax.php",
      "/wp-json/wp/v2/posts",
      "/wp-includes/js/jquery.js",
      "/wp-content/themes/flatsome/style.css",
      "/wp-content/uploads",
      "/feed/",
      "/feed/atom",
      "/comments/feed",
      "/tava-bakimi/feed/",
      "/category/rehberler/feed/rss2",
      "/?feed=rss2",
      "/?attachment_id=101",
    ]) {
      expect(addressOf(raw)).toEqual({ kind: "gone" })
    }
    expect(addressOf("/feed/x")).toBeNull()
  })

  it("sends WooCommerce's own pages, English and Turkish, to the storefront's", () => {
    const pages: Record<string, string> = {
      "/cart/": "/sepet",
      "/sepetim": "/sepet",
      "/checkout": "/sepet",
      "/checkout/order-received/123": "/hesap/siparisler",
      "/my-account/": "/hesap",
      "/my-account/orders": "/hesap/siparisler",
      "/my-account/edit-address/billing": "/hesap/adresler",
      "/hesabim/hesap-detaylari": "/hesap/bilgiler",
      "/my-account/lost-password": "/hesap/sifre-sifirla",
      "/hesabim/downloads": "/hesap",
      "/shop/": "/magaza",
      "/wishlist": "/hesap/favoriler",
      "/istek-listesi": "/hesap/favoriler",
    }
    for (const [raw, path] of Object.entries(pages)) {
      expect(addressOf(raw)).toEqual({ kind: "page", path })
    }
  })

  it("leaves every other path alone", () => {
    for (const raw of ["/urun/dokum-tava", "/el-yapimi-caki", "/kategori/x/page", "/blog/tava"]) {
      expect(addressOf(raw)).toBeNull()
    }
  })

  it("keeps the visitor's parameters, WordPress's left out", () => {
    const query = new URLSearchParams("p=1&utm_source=x&filter_renk=a&query_type_renk=or&gclid=y")
    expect(keptQuery(query).toString()).toBe("utm_source=x&gclid=y")
  })
})
