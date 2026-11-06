/**
 * A small WordPress + WooCommerce export written for the tests (F14,
 * adr/0042 Ek 2026-11-03): every kind the source reads and the edge cases
 * it names. Made up: `example.com` addresses, invented names. Never the
 * owner's export, which stays out of the repository.
 */

type Php = string | number | boolean | null | Php[] | { [key: string]: Php }

/** A value as PHP's `serialize()` writes it: strings by their UTF-8 byte count. */
export function serialize(value: Php): string {
  if (value === null) {
    return "N;"
  }
  if (typeof value === "boolean") {
    return `b:${value ? "1" : "0"};`
  }
  if (typeof value === "number") {
    return Number.isInteger(value) ? `i:${String(value)};` : `d:${String(value)};`
  }
  if (typeof value === "string") {
    return `s:${String(Buffer.byteLength(value, "utf8"))}:"${value}";`
  }
  const entries = Array.isArray(value)
    ? value.map((each, index) => [index, each] as const)
    : Object.entries(value)
  return `a:${String(entries.length)}:{${entries
    .map(([key, each]) => `${serialize(key)}${serialize(each)}`)
    .join("")}}`
}

const cdata = (text: string) => `<![CDATA[${text.replace(/]]>/g, "]]]]><![CDATA[>")}]]>`
const meta = (pairs: Record<string, string>, tag = "wp:postmeta") =>
  Object.entries(pairs)
    .map(
      ([key, value]) =>
        `<${tag}><wp:meta_key>${cdata(key)}</wp:meta_key><wp:meta_value>${cdata(value)}</wp:meta_value></${tag}>`
    )
    .join("")
const terms = (list: [string, string, string][]) =>
  list
    .map(
      ([domain, slug, name]) =>
        `<category domain="${domain}" nicename="${slug}">${cdata(name)}</category>`
    )
    .join("")

interface Item {
  id: number
  type: string
  title: string
  slug: string
  status?: string
  link?: string
  parent?: number
  order?: number
  content?: string
  excerpt?: string
  date?: string
  terms?: [string, string, string][]
  meta?: Record<string, string>
  comments?: string
  attachment?: string
}

function item(site: string, own: Item): string {
  return `<item>
<title>${cdata(own.title)}</title>
<link>${own.link ?? `${site}/${own.slug}/`}</link>
<dc:creator>${cdata("yazar")}</dc:creator>
<content:encoded>${cdata(own.content ?? "")}</content:encoded>
<excerpt:encoded>${cdata(own.excerpt ?? "")}</excerpt:encoded>
<wp:post_id>${String(own.id)}</wp:post_id>
<wp:post_date_gmt>${cdata(own.date ?? "2025-05-10 09:00:00")}</wp:post_date_gmt>
<wp:post_name>${cdata(own.slug)}</wp:post_name>
<wp:status>${cdata(own.status ?? "publish")}</wp:status>
<wp:post_parent>${String(own.parent ?? 0)}</wp:post_parent>
<wp:menu_order>${String(own.order ?? 0)}</wp:menu_order>
<wp:post_type>${cdata(own.type)}</wp:post_type>
<wp:post_password>${cdata("")}</wp:post_password>
${own.attachment ? `<wp:attachment_url>${cdata(own.attachment)}</wp:attachment_url>` : ""}
${terms(own.terms ?? [])}
${meta(own.meta ?? {})}
${own.comments ?? ""}
</item>`
}

function comment(id: number, approved: string, rating: string | null, text: string): string {
  return `<wp:comment>
<wp:comment_id>${String(id)}</wp:comment_id>
<wp:comment_author>${cdata("Ayşe Yılmaz")}</wp:comment_author>
<wp:comment_author_email>${cdata("ayse@example.com")}</wp:comment_author_email>
<wp:comment_author_IP>${cdata("192.0.2.7")}</wp:comment_author_IP>
<wp:comment_date_gmt>${cdata("2025-06-01 10:00:00")}</wp:comment_date_gmt>
<wp:comment_content>${cdata(text)}</wp:comment_content>
<wp:comment_approved>${cdata(approved)}</wp:comment_approved>
<wp:comment_type>${cdata("review")}</wp:comment_type>
${rating === null ? "" : meta({ rating, verified: "0" }, "wp:commentmeta")}
</wp:comment>`
}

const term = (id: number, taxonomy: string, slug: string, name: string, extra = "") =>
  `<wp:term><wp:term_id>${String(id)}</wp:term_id><wp:term_taxonomy>${cdata(taxonomy)}</wp:term_taxonomy><wp:term_slug>${cdata(slug)}</wp:term_slug>${extra}<wp:term_name>${cdata(name)}</wp:term_name></wp:term>`

const attributes = serialize({
  pa_renk: {
    name: "pa_renk",
    value: "",
    position: 0,
    is_visible: 1,
    is_variation: 1,
    is_taxonomy: 1,
  },
  pa_boyut: {
    name: "pa_boyut",
    value: "",
    position: 1,
    is_visible: 1,
    is_variation: 1,
    is_taxonomy: 1,
  },
  pa_desen: {
    name: "pa_desen",
    value: "",
    position: 2,
    is_visible: 1,
    is_variation: 0,
    is_taxonomy: 1,
  },
  pa_malzeme: {
    name: "pa_malzeme",
    value: "",
    position: 3,
    is_visible: 1,
    is_variation: 0,
    is_taxonomy: 1,
  },
})

export interface FixtureOptions {
  /**
   * Categories' own pictures (`thumbnail_id`): Mutfak's a file of its own
   * (titled as its file), Tavalar's the pan's product picture, and a third
   * category, Kaşıklar, naming an attachment the media library lacks.
   */
  covers?: boolean
}

/** The export of an old shop at `site`: its media on the same host. */
export function wxrFixture(
  site = "https://eski.example.com",
  options: FixtureOptions = {}
): string {
  const upload = (name: string) => `${site}/wp-content/uploads/2026/01/${name}`
  const cover = (id: string): Record<string, string> => (options.covers ? { thumbnail_id: id } : {})
  const coverItems: Item[] = options.covers
    ? [
        {
          id: 105,
          type: "attachment",
          title: "mutfak",
          slug: "mutfak-2",
          status: "inherit",
          attachment: upload("mutfak.png"),
        },
      ]
    : []
  const coverTerms = options.covers
    ? term(
        30,
        "product_cat",
        "kasiklar",
        "Kaşıklar",
        `<wp:term_parent>${cdata("mutfak")}</wp:term_parent>${meta({ thumbnail_id: "999" }, "wp:termmeta")}`
      )
    : ""
  const items: Item[] = [
    ...coverItems,
    {
      id: 101,
      type: "attachment",
      title: "tava",
      slug: "tava",
      status: "inherit",
      attachment: upload("tava.png"),
      meta: { _wp_attachment_image_alt: "Döküm tava önden" },
    },
    {
      id: 102,
      type: "attachment",
      title: "tava-yan",
      slug: "tava-yan",
      status: "inherit",
      attachment: upload("tava-yan.png"),
    },
    {
      id: 103,
      type: "attachment",
      title: "kapak",
      slug: "kapak",
      status: "inherit",
      attachment: upload("kapak.png"),
      meta: { _wp_attachment_image_alt: "Tava bakımı kapak" },
    },
    {
      id: 104,
      type: "attachment",
      title: "kirmizi",
      slug: "kirmizi",
      status: "inherit",
      attachment: upload("kirmizi.png"),
    },
    {
      id: 10,
      type: "product",
      title: "Döküm Tava",
      slug: "dokum-tava",
      link: `${site}/urun/dokum-tava/`,
      content: `<!-- wp:html -->[section label="Hero"][row][col span="12"][ux_text]<h2>Özellikler</h2><ul><li>Döküm <strong>gövde</strong></li><li>24 ve 28 cm</li></ul><table><tr><th>Ölçü</th><td>28 cm</td></tr><tr><th>Ağırlık</th><td>1,5 kg</td></tr></table>[/ux_text][/col][/row][/section][ux_products cat="12"]<script>alert("x")</script><!-- /wp:html -->`,
      terms: [
        ["product_cat", "mutfak", "Mutfak &amp; Şef"],
        ["product_cat", "tavalar", "Tavalar"],
        ["product_brand", "demirci", "Demirci"],
        ["pa_renk", "kirmizi", "Kırmızı"],
        ["pa_renk", "mavi", "Mavi"],
        ["pa_boyut", "24-cm", "24 cm"],
        ["pa_boyut", "28-cm", "28 cm"],
        ["pa_desen", "cizgili", "Çizgili"],
        ["pa_malzeme", "dokum-demir", "Döküm Demir"],
        ["product_tag", "hediye", "hediye"],
        ["product_type", "variable", "variable"],
      ],
      meta: {
        _thumbnail_id: "101",
        _product_image_gallery: "102,999",
        _product_attributes: attributes,
        rank_math_title: "%title% %sep% %sitename%",
        rank_math_description: "Ağır döküm tava &amp; kapak.",
        rank_math_focus_keyword: "döküm tava,tava",
        rank_math_primary_product_cat: "21",
        _weight: "1.5",
        _length: "30",
        _width: "30",
        _height: "8",
      },
      comments: [
        comment(901, "1", "5", "Çok <b>iyi</b> tava."),
        comment(902, "0", "4", "Güzel."),
        comment(903, "spam", "1", "Reklam"),
        comment(904, "1", null, "Puansız soru"),
      ].join(""),
    },
    {
      id: 11,
      type: "product_variation",
      title: "Döküm Tava - Kırmızı",
      slug: "dokum-tava-kirmizi",
      parent: 10,
      order: 1,
      meta: {
        attribute_pa_renk: "kirmizi",
        attribute_pa_boyut: "24-cm",
        _regular_price: "1000",
        _sale_price: "899.90",
        _price: "899.90",
        _sku: "TAVA-K-24",
        _manage_stock: "yes",
        _stock: "5",
        _thumbnail_id: "104",
      },
    },
    {
      id: 12,
      type: "product_variation",
      title: "Döküm Tava - Mavi",
      slug: "dokum-tava-mavi",
      parent: 10,
      order: 2,
      meta: {
        attribute_pa_renk: "mavi",
        attribute_pa_boyut: "28-cm",
        _regular_price: "1200",
        _price: "1200",
        _sku: "TAVA-M-28",
        _manage_stock: "no",
        _stock_status: "outofstock",
        _weight: "1.8",
      },
    },
    {
      id: 13,
      type: "product_variation",
      title: "Kapalı",
      slug: "kapali",
      status: "private",
      parent: 10,
      order: 3,
      meta: { attribute_pa_renk: "mavi", attribute_pa_boyut: "24-cm", _regular_price: "1100" },
    },
    {
      id: 14,
      type: "product_variation",
      title: "Yetim",
      slug: "yetim",
      parent: 999,
      meta: { _regular_price: "10" },
    },
    {
      id: 20,
      type: "product",
      title: "Ahşap Kaşık",
      slug: "ahsap-kasik",
      link: `${site}/urun/ahsap-kasik/`,
      excerpt: "<p>El yapımı kaşık.</p>",
      terms: [
        ["product_cat", "mutfak", "Mutfak &amp; Şef"],
        ["product_type", "simple", "simple"],
      ],
      meta: {
        _regular_price: "149.9",
        _price: "149.9",
        _sku: "KASIK-1",
        _manage_stock: "no",
        _stock_status: "instock",
        _product_attributes: serialize({
          malzeme: {
            name: "Malzeme",
            value: "Kayın | Ceviz",
            position: 0,
            is_visible: 1,
            is_variation: 0,
            is_taxonomy: 0,
          },
        }),
      },
    },
    {
      id: 30,
      type: "product",
      title: "Gizli Ürün",
      slug: "gizli-urun",
      link: `${site}/urun/gizli-urun/`,
      terms: [
        ["product_visibility", "exclude-from-catalog", "exclude-from-catalog"],
        ["product_visibility", "exclude-from-search", "exclude-from-search"],
      ],
      meta: { _regular_price: "50" },
    },
    {
      id: 31,
      type: "product",
      title: "Taslak Ürün",
      slug: "taslak-urun",
      status: "draft",
      link: `${site}/?post_type=product&amp;p=31`,
      meta: { _regular_price: "100" },
    },
    {
      id: 32,
      type: "product",
      title: "Çöpteki",
      slug: "copteki",
      status: "trash",
      meta: { _regular_price: "100" },
    },
    {
      id: 33,
      type: "product",
      title: "Set",
      slug: "set",
      terms: [["product_type", "grouped", "grouped"]],
    },
    {
      id: 40,
      type: "post",
      title: "Tava Bakımı",
      slug: "tava-bakimi",
      date: "2024-03-01 07:30:00",
      content: `<!-- wp:paragraph --><p>Merhaba <strong>dünya</strong>, <a href="${site}/urun/dokum-tava/">tavaya</a> bakın: <a href="/mutfak/tavalar/">tavalar</a>, <a href="${site}/marka/demirci/">Demirci</a>.</p><!-- /wp:paragraph --><figure><img src="${upload("x.png")}" alt="x"></figure>[sss_item soru="Nasıl yıkanır?"]Elde yıkayın.[/sss_item]`,
      excerpt: "Tavanızı uzun yıllar kullanın.",
      terms: [
        ["category", "genel", "Genel"],
        ["category", "rehberler", "Rehberler"],
        ["post_tag", "dokum", "döküm"],
        ["post_tag", "bakim", "bakım"],
        ["post_tag", "sss-item-x", '[sss_item soru="x"] x'],
      ],
      meta: {
        _thumbnail_id: "103",
        rank_math_primary_category: "5",
        rank_math_title: "Tava Bakımı Rehberi %sep% %sitename%",
        rank_math_description: "Döküm tava nasıl temizlenir?",
      },
    },
    {
      id: 50,
      type: "page",
      title: "Hakkımızda",
      slug: "hakkimizda",
      content: "<h1>Hakkımızda</h1><p>Biz bir <em>aile</em> işletmesiyiz.</p>",
    },
    {
      id: 51,
      type: "page",
      title: "Satış Sözleşmesi",
      slug: "satis-sozlesmesi",
      content: "<p>Madde 1</p>",
    },
    {
      id: 52,
      type: "page",
      title: "Sepet",
      slug: "sepet-sayfasi",
      content: "<!-- wp:shortcode -->[woocommerce_cart]<!-- /wp:shortcode -->",
    },
    {
      id: 53,
      type: "page",
      title: "Ana Sayfa",
      slug: "ana-sayfa",
      link: `${site}/`,
      content: '[block id="hero"]',
    },
    {
      id: 54,
      type: "page",
      title: "Eski Kampanya",
      slug: "eski-kampanya",
      content: "<p>Kampanya bitti.</p>",
      meta: { rank_math_robots: serialize(["noindex", "nofollow"]) },
    },
    { id: 60, type: "nav_menu_item", title: "", slug: "60" },
    { id: 70, type: "shop_coupon", title: "HOSGELDIN", slug: "hosgeldin" },
    {
      id: 80,
      type: "blocks",
      title: "Mutfak blok",
      slug: "mutfak-blok",
      content: "[ux_text]<p>Mutfak için <b>her şey</b>.</p>[/ux_text]",
    },
  ]
  return `<?xml version="1.0" encoding="UTF-8" ?>
<!-- generator="WordPress/7.1.4" -->
<rss version="2.0"
	xmlns:excerpt="http://wordpress.org/export/1.2/excerpt/"
	xmlns:content="http://purl.org/rss/1.0/modules/content/"
	xmlns:wfw="http://wellformedweb.org/CommentAPI/"
	xmlns:dc="http://purl.org/dc/elements/1.1/"
	xmlns:wp="http://wordpress.org/export/1.2/"
>
<channel>
<title>Örnek Ev &amp; Mutfak</title>
<link>${site}</link>
<wp:wxr_version>1.2</wp:wxr_version>
<wp:base_site_url>${site}</wp:base_site_url>
<wp:author><wp:author_id>1</wp:author_id><wp:author_login>${cdata("yazar")}</wp:author_login><wp:author_email>${cdata("yazar@example.com")}</wp:author_email><wp:author_display_name>${cdata("Örnek Yazar")}</wp:author_display_name></wp:author>
<wp:category><wp:term_id>5</wp:term_id><wp:category_nicename>${cdata("rehberler")}</wp:category_nicename><wp:category_parent>${cdata("")}</wp:category_parent><wp:cat_name>${cdata("Rehberler")}</wp:cat_name><wp:category_description>${cdata("Bakım ve kullanım rehberleri.")}</wp:category_description>${meta({ rank_math_title: "Rehberler %sep% %sitename%" }, "wp:termmeta")}</wp:category>
<wp:category><wp:term_id>6</wp:term_id><wp:category_nicename>${cdata("genel")}</wp:category_nicename><wp:category_parent>${cdata("")}</wp:category_parent><wp:cat_name>${cdata("Genel")}</wp:cat_name></wp:category>
<wp:tag><wp:term_id>7</wp:term_id><wp:tag_slug>${cdata("dokum")}</wp:tag_slug><wp:tag_name>${cdata("döküm")}</wp:tag_name></wp:tag>
<wp:tag><wp:term_id>8</wp:term_id><wp:tag_slug>${cdata("bakim")}</wp:tag_slug><wp:tag_name>${cdata("bakım")}</wp:tag_name></wp:tag>
${term(20, "product_cat", "mutfak", "Mutfak &amp; Şef", `<wp:term_parent>${cdata("")}</wp:term_parent>${meta({ cat_meta: serialize({ cat_header: "", cat_footer: '[block id="mutfak-blok"]' }), rank_math_title: "%term% %sep% %sitename%", ...cover("105") }, "wp:termmeta")}`)}
${term(21, "product_cat", "tavalar", "Tavalar", `<wp:term_parent>${cdata("mutfak")}</wp:term_parent><wp:term_description>${cdata("<p>Döküm tavalar.</p>")}</wp:term_description>${meta({ rank_math_title: "%term% Modelleri %sep% %sitename%", rank_math_description: "Her ocağa uygun döküm tavalar.", rank_math_focus_keyword: "döküm tava,tava", ...cover("101") }, "wp:termmeta")}`)}
${coverTerms}
${term(22, "product_brand", "demirci", "Demirci")}
${term(23, "pa_renk", "kirmizi", "Kırmızı")}
${term(24, "pa_renk", "mavi", "Mavi")}
${term(25, "pa_boyut", "24-cm", "24 cm")}
${term(26, "pa_boyut", "28-cm", "28 cm")}
${term(27, "pa_desen", "cizgili", "Çizgili")}
${term(29, "pa_malzeme", "dokum-demir", "Döküm Demir")}
${term(28, "product_tag", "hediye", "hediye")}
${items.map((each) => item(site, each)).join("\n")}
</channel>
</rss>
`
}
