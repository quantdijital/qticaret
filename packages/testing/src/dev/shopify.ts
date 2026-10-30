import { DEMO_SHOPIFY } from "../shopify/demo"
import { startFakeShopify } from "../shopify/fake-server"

/**
 * The fake Shopify store for a developer's machine (adr/0042): `pnpm
 * dev:shopify`, with the backend started as
 * `SHOPIFY_BASE_URL=http://127.0.0.1:9107`, then the app below entered in
 * the panel (Settings > Integrations > Shopify) and a migration run.
 *
 * The values are fixed so the panel keeps its connection between runs,
 * and readable on purpose (docs/04): no scanner takes them for real ones.
 */
const app = {
  clientId: "gelistirme-shopify-uygulamasi",
  clientSecret: "gelistirme-sahte-shopify-sirri",
}

const port = Number(process.env["FAKE_SHOPIFY_PORT"] ?? 9107)

void startFakeShopify(app, { port, data: DEMO_SHOPIFY }).then((fake) => {
  process.stdout.write(
    [
      `Sahte Shopify ${fake.url} adresinde.`,
      `Backend: SHOPIFY_BASE_URL=${fake.url}`,
      "Panel > Ayarlar > Entegrasyonlar > Shopify:",
      "  Mağaza adresi: gelistirme.myshopify.com",
      `  Client ID: ${app.clientId}`,
      `  Client secret: ${app.clientSecret}`,
      "",
    ].join("\n")
  )
})
