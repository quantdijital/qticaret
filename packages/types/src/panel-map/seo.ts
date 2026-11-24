import type { PanelMapEntry } from "./types.js"

/**
 * Settings › SEO, the shop's one SEO home, and its tabs (`SEO_PART_ITEMS`):
 * the daily work for everyone, the settings for a role that may change them.
 */
export const SEO_ENTRIES = [
  {
    key: "settings.seo",
    parent: "settings",
    path: "/settings/seo",
    label: "settings.sections.seo",
    keywords: {
      tr: ["seo", "google sıralaması", "arama motoru", "görünürlük"],
      en: ["seo", "google ranking", "search engine", "visibility"],
    },
    help: {
      tr: "Mağazanın arama motorlarında ve yapay zekâ aramalarında nasıl göründüğü: öneriler, denetim, yönlendirmeler ve ayarlar.",
      en: "How the shop shows in search engines and AI search: advice, audit, redirects and settings.",
    },
  },
  {
    key: "settings.seo.overview",
    parent: "settings.seo",
    path: "/settings/seo",
    search: { part: "overview" },
    label: "settings.seo.tabs.overview",
    keywords: { tr: ["seo puanı", "seo durumu"], en: ["seo score", "seo status"] },
    help: { tr: "Mağazanın SEO durumunun özeti.", en: "A summary of the shop's SEO." },
  },
  {
    key: "settings.seo.advisor",
    parent: "settings.seo",
    path: "/settings/seo",
    search: { part: "advisor" },
    label: "settings.seo.tabs.advisor",
    keywords: {
      tr: ["seo önerisi", "eksik açıklama", "iyileştirme"],
      en: ["seo advice", "missing description", "improvements"],
    },
    help: {
      tr: "Ürün ve sayfalar için yapılacak SEO düzeltmeleri, önem sırasıyla.",
      en: "SEO fixes for products and pages, most important first.",
    },
  },
  {
    key: "settings.seo.audit",
    parent: "settings.seo",
    path: "/settings/seo",
    search: { part: "audit" },
    label: "settings.seo.tabs.audit",
    keywords: {
      tr: ["kırık bağlantı", "404", "site taraması", "hata sayfası"],
      en: ["broken link", "404", "site crawl", "error page"],
    },
    help: {
      tr: "Vitrinin taranması: kırık bağlantılar, 404'ler ve teknik sorunlar.",
      en: "A crawl of the storefront: broken links, 404s and technical problems.",
    },
  },
  {
    key: "settings.seo.redirects",
    parent: "settings.seo",
    path: "/settings/seo",
    search: { part: "redirects" },
    label: "settings.seo.tabs.redirects",
    keywords: {
      tr: ["301", "yönlendirme", "eski adres", "adres değişikliği"],
      en: ["301", "redirect", "old url", "url change"],
    },
    help: {
      tr: "Eski adresleri yenilerine yönlendiren 301 kayıtları.",
      en: "The 301 records sending old addresses to new ones.",
    },
  },
  {
    key: "settings.seo.siteSearch",
    parent: "settings.seo",
    path: "/settings/seo",
    search: { part: "site-search" },
    label: "settings.seo.tabs.siteSearch",
    keywords: {
      tr: ["eş anlamlı", "arama sonucu", "site içi arama", "arama ayarı"],
      en: ["synonyms", "search results", "site search", "search settings"],
    },
    help: {
      tr: "Vitrin aramasının eş anlamlı sözcükleri ve sonuçların sırası.",
      en: "Storefront search's synonyms and the order of its results.",
    },
  },
  {
    key: "settings.seo.addresses",
    parent: "settings.seo",
    path: "/settings/seo",
    search: { part: "addresses" },
    needs: "settings",
    label: "settings.seo.tabs.addresses",
    keywords: {
      tr: ["alan adı", "domain", "www", "adres yapısı", "slug", "url"],
      en: ["domain", "www", "url structure", "slug"],
    },
    help: {
      tr: "Mağazanın ana alan adı ve ürün, kategori adreslerinin biçimi.",
      en: "The shop's main domain and the shape of product and category addresses.",
    },
  },
  {
    key: "settings.seo.pages",
    parent: "settings.seo",
    path: "/settings/seo",
    search: { part: "pages" },
    needs: "settings",
    label: "settings.seo.tabs.pages",
    keywords: {
      tr: ["meta başlık", "meta açıklama", "paylaşım görseli", "sayfa başlığı"],
      en: ["meta title", "meta description", "share image", "page title"],
    },
    help: {
      tr: "Sayfa başlıklarının ve açıklamalarının kalıpları, paylaşım görseli.",
      en: "The patterns of page titles and descriptions, and the share image.",
    },
  },
  {
    key: "settings.seo.search",
    parent: "settings.seo",
    path: "/settings/seo",
    search: { part: "search" },
    needs: "settings",
    label: "settings.seo.tabs.search",
    keywords: {
      tr: ["google search console", "site haritası", "sitemap", "robots", "bing"],
      en: ["google search console", "sitemap", "robots", "bing", "indexing"],
    },
    help: {
      tr: "Search Console doğrulaması, site haritası ve robots ayarları.",
      en: "Search Console verification, the sitemap and robots settings.",
    },
  },
] satisfies readonly PanelMapEntry[]
