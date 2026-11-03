import { devSender, trackingHelp } from "../carrier/dev"
import { advanceModeFromEnv } from "../carrier/tracking"
import { startFakeYurtici } from "../yurtici/fake-server"

/**
 * Yurtiçi Kargo's service on a developer's machine (adr/0035):
 * `pnpm dev:yurtici`, with the backend started as
 * `YURTICI_BASE_URL=http://127.0.0.1:9105`. Parcels wait at "label
 * created" until moved on from Yurtiçi's tracking page, and survive a
 * restart. Yurtiçi gives no label: the panel prints its own.
 *
 * The logins are fixed so the panel keeps them between runs, and readable
 * on purpose (docs/04): no scanner takes them for real ones, and real
 * Yurtiçi refuses them.
 */
const accounts = {
  main: { username: "gelistirme-yurtici", password: "gelistirme-yurtici-sifresi" },
  cod: { username: "gelistirme-yurtici-tahsilat", password: "gelistirme-tahsilat-sifresi" },
}

const port = Number(process.env["FAKE_YURTICI_PORT"] ?? 9105)
const advance = advanceModeFromEnv()
const { town, city } = devSender()

void startFakeYurtici(accounts, { port, advance, origin: { town, city }, persist: true }).then(
  (fake) => {
    process.stdout.write(
      [
        `Yurtiçi Kargo geliştirme servisi ${fake.url} adresinde.`,
        `Backend: YURTICI_BASE_URL=${fake.url}`,
        "Panel > Ayarlar > Kargo > Yurtiçi Kargo:",
        `  Kullanıcı adı: ${accounts.main.username}`,
        `  Şifre: ${accounts.main.password}`,
        `  Tahsilatlı hesap kullanıcı adı: ${accounts.cod.username}`,
        `  Tahsilatlı hesap şifresi: ${accounts.cod.password}`,
        "  Test modu KAPALI kalsın: adres tanımlıyken bu servis her modda kullanılır,",
        "  etiket canlıdaki gibi çıkar (TEST kutusu olmadan).",
        ...trackingHelp(fake.url, "yurtici", port, advance).map((line) =>
          line
            .replaceAll("<takip no>", "<gönderi no>")
            .replace("(etiketteki ve paneldeki numara)", "(paneldeki takip numarası)")
        ),
        "",
      ].join("\n")
    )
  }
)
