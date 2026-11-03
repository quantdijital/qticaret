import { startFakeAras } from "../aras/fake-server"
import { devSender, trackingHelp } from "../carrier/dev"
import { advanceModeFromEnv } from "../carrier/tracking"

/**
 * Aras Kargo's service on a developer's machine (adr/0035): `pnpm dev:aras`,
 * with the backend started as `ARAS_BASE_URL=http://127.0.0.1:9104`. Labels
 * are drawn as Aras prints them, parcels wait at "label created" until
 * moved on from the tracking page, and both survive a restart.
 *
 * The account is fixed so the panel keeps it between runs, and readable on
 * purpose (docs/04): no scanner takes it for a real one, and real Aras
 * refuses it.
 */
const account = { username: "gelistirme-aras", password: "gelistirme-aras-sifresi" }

const port = Number(process.env["FAKE_ARAS_PORT"] ?? 9104)
const advance = advanceModeFromEnv()

void startFakeAras(account, { port, advance, sender: devSender(), persist: true }).then((fake) => {
  process.stdout.write(
    [
      `Aras Kargo geliştirme servisi ${fake.url} adresinde.`,
      `Backend: ARAS_BASE_URL=${fake.url}`,
      "Panel > Ayarlar > Kargo > Aras Kargo:",
      `  Kullanıcı adı: ${account.username}`,
      `  Şifre: ${account.password}`,
      "  Test modu KAPALI kalsın: adres tanımlıyken bu servis her modda kullanılır,",
      "  etiket canlıdaki gibi çıkar (TEST kutusu olmadan).",
      ...trackingHelp(fake.url, "aras", port, advance),
      "",
    ].join("\n")
  )
})
