import { devSender, trackingHelp } from "../carrier/dev"
import { advanceModeFromEnv } from "../carrier/tracking"
import { startFakeSurat } from "../surat/fake-server"

/**
 * Sürat Kargo's web service on a developer's machine (docs/entegrasyonlar/
 * surat.md): `pnpm dev:surat`, with the backend started as
 * `SURAT_BASE_URL=http://127.0.0.1:9111`. Sürat has no test service: this
 * is the only way to try it without a real parcel. Parcels wait until the
 * branch takes them, moved on from the tracking page, and survive a
 * restart. Sürat's own label only with `FAKE_SURAT_BARCODE=1` (Sürat
 * seldom grants it); otherwise the panel prints its own.
 *
 * The logins are fixed so the panel keeps them between runs, and readable
 * on purpose (docs/04): real Sürat refuses them.
 */
const accounts = {
  shipping: { username: "gelistirme-surat", password: "gelistirme-surat-sifresi" },
  tracking: { cariCode: "900000002", webPassword: "gelistirme-web-sifresi" },
}

const port = Number(process.env["FAKE_SURAT_PORT"] ?? 9111)
const advance = advanceModeFromEnv()
const sender = devSender()
const barcode = process.env["FAKE_SURAT_BARCODE"] === "1"

void startFakeSurat(accounts, {
  port,
  advance,
  origin: { town: sender.town, city: sender.city },
  sender,
  barcode,
  persist: true,
}).then((fake) => {
  process.stdout.write(
    [
      `Sürat Kargo geliştirme servisi ${fake.url} adresinde.`,
      `Backend: SURAT_BASE_URL=${fake.url}`,
      "Panel > Ayarlar > Kargo > Sürat Kargo:",
      `  Kullanıcı adı: ${accounts.shipping.username}`,
      `  Şifre: ${accounts.shipping.password}`,
      `  Cari kodu: ${accounts.tracking.cariCode}`,
      `  Web şifresi: ${accounts.tracking.webPassword}`,
      barcode
        ? "  Barkod yetkisi açık: etiketi Sürat verir."
        : "  Barkod yetkisi kapalı: etiketi panel çizer (FAKE_SURAT_BARCODE=1 ile açılır).",
      ...trackingHelp(fake.url, "surat", port, advance).map((line) =>
        line.replace("(etiketteki ve paneldeki numara)", "(paneldeki Sürat takip numarası)")
      ),
      "",
    ].join("\n")
  )
})
