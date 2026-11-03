import { trackingHelp } from "../carrier/dev"
import { advanceModeFromEnv } from "../carrier/tracking"
import { startFakeGeliver } from "../geliver/fake-server"
import { MARKET_SERVICES } from "../geliver/prices"

/**
 * Geliver on a developer's machine (adr/0031): `pnpm dev:geliver`, with the
 * backend started as `GELIVER_BASE_URL=http://127.0.0.1:9103/api/v1`. It
 * offers PTT, Sürat, MNG, Aras and Yurtiçi at desi-band prices, hands out
 * the chosen carrier's label, keeps shipments at "label created" until
 * moved on from the carrier's tracking page, and survives a restart.
 *
 * The token is fixed so the panel keeps it between runs, and readable on
 * purpose (docs/04): no scanner takes it for a real one, and real Geliver
 * refuses it.
 */
export const DEV_GELIVER_TOKEN = "gelistirme-geliver-anahtari"

const port = Number(process.env["FAKE_GELIVER_PORT"] ?? 9103)
const advance = advanceModeFromEnv()

void startFakeGeliver(DEV_GELIVER_TOKEN, {
  port,
  advance,
  services: MARKET_SERVICES,
  persist: true,
}).then((fake) => {
  const origin = fake.url.replace(/\/api\/v1$/, "")
  process.stdout.write(
    [
      `Geliver geliştirme servisi ${fake.url} adresinde.`,
      `Backend: GELIVER_BASE_URL=${fake.url}`,
      "Panel > Ayarlar > Kargo > Geliver:",
      `  API anahtarı: ${DEV_GELIVER_TOKEN}`,
      "  Test gönderileri KAPALI kalsın: adres tanımlıyken bu servis her modda kullanılır,",
      "  etiket canlıdaki gibi çıkar (TEST kutusu olmadan).",
      ...trackingHelp(origin, "geliver", port, advance),
      "",
    ].join("\n")
  )
})
