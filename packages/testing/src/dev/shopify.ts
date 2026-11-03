import { DEMO_SHOPIFY } from "../shopify/demo"
import { startFakeShopify } from "../shopify/fake-server"
import { storeFeed } from "../shopify/feed"
import { cleanShopifyStore } from "../shopify/store"

/**
 * A Shopify store on a developer's machine (adr/0042): `pnpm dev:shopify`,
 * with the backend started as `SHOPIFY_BASE_URL=http://127.0.0.1:9107`,
 * then the app below entered in the panel (Settings > Integrations >
 * Shopify) and a migration run. It serves a tidy store, its pictures, feed
 * and sitemaps its own, so the run's report is clean;
 * `FAKE_SHOPIFY_EDGE_CASES=1` serves the tests' store instead, its faults
 * on purpose.
 *
 * The values are fixed so the panel keeps its connection between runs,
 * and readable on purpose (docs/04): no scanner takes them for real ones.
 */
const app = {
  clientId: "gelistirme-shopify-uygulamasi",
  clientSecret: "gelistirme-shopify-sirri",
}

const port = Number(process.env["FAKE_SHOPIFY_PORT"] ?? 9107)
const edgeCases = process.env["FAKE_SHOPIFY_EDGE_CASES"] === "1"

void startFakeShopify(
  app,
  edgeCases
    ? { port, data: structuredClone(DEMO_SHOPIFY) }
    : { port, data: cleanShopifyStore, feed: storeFeed, foreignSitemaps: false }
).then((fake) => {
  process.stdout.write(
    [
      `Shopify geliştirme mağazası ${fake.url} adresinde${edgeCases ? " (hatalı kayıtlarla)" : ""}.`,
      `Backend: SHOPIFY_BASE_URL=${fake.url}`,
      "Panel > Ayarlar > Entegrasyonlar > Shopify:",
      "  Mağaza adresi: gelistirme.myshopify.com",
      `  Client ID: ${app.clientId}`,
      `  Client secret: ${app.clientSecret}`,
      `Ürün akışı: ${fake.url}/feeds/merchant.xml · Site haritası: ${fake.url}/sitemap.xml`,
      edgeCases
        ? "Hatalı kayıtlar (eksik fiyat, eksi stok, yurt dışı adres) bilerek var."
        : "Testlerin hatalı kayıtlarını görmek için: FAKE_SHOPIFY_EDGE_CASES=1",
      "",
    ].join("\n")
  )
})
