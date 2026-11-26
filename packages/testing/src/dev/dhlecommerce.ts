import { devSender, trackingHelp } from "../carrier/dev"
import { advanceModeFromEnv } from "../carrier/tracking"
import { startFakeDhlEcom } from "../dhlecommerce/fake-server"

/**
 * DHL eCommerce's API on a developer's machine (docs/entegrasyonlar/
 * dhlecommerce.md): `pnpm dev:dhlecommerce`, with the backend started as
 * `DHL_ECOMMERCE_BASE_URL=http://127.0.0.1:9110`. Parcels wait at "label
 * created" until moved on from the tracking page, and survive a restart.
 * DHL gives a Zebra label only: the panel prints its own PDF.
 *
 * The app keys are the backend's development app (`DHL_ECOMMERCE_DEV_APP`,
 * used when the server names none with a fake set); the shop's customer
 * number and password are fixed so the panel keeps them between runs, and
 * readable on purpose (docs/04): real DHL refuses them.
 */
const app = { clientId: "gelistirme-dhl-uygulama", clientSecret: "gelistirme-dhl-uygulama-sirri" }
const account = { customerNumber: "900000001", password: "gelistirme-dhl-sifresi" }

const port = Number(process.env["FAKE_DHL_ECOMMERCE_PORT"] ?? 9110)
const advance = advanceModeFromEnv()
const { town, city } = devSender()

void startFakeDhlEcom(app, account, { port, advance, origin: { town, city }, persist: true }).then(
  (fake) => {
    process.stdout.write(
      [
        `DHL eCommerce geliştirme servisi ${fake.url} adresinde.`,
        `Backend: DHL_ECOMMERCE_BASE_URL=${fake.url}`,
        "  (DHL_ECOMMERCE_CLIENT_ID/SECRET boş kalsın: geliştirme uygulaması kullanılır.)",
        "Panel > Ayarlar > Kargo > DHL eCommerce:",
        `  Müşteri numarası: ${account.customerNumber}`,
        `  Şifre: ${account.password}`,
        "  Test modu KAPALI kalsın: adres tanımlıyken bu servis her modda kullanılır,",
        "  etiket canlıdaki gibi çıkar (TEST kutusu olmadan).",
        ...trackingHelp(fake.url, "dhlecommerce", port, advance).map((line) =>
          line
            .replaceAll("<takip no>", "<gönderi no>")
            .replace("(etiketteki ve paneldeki numara)", "(etiketteki ve paneldeki gönderi no)")
        ),
        "",
      ].join("\n")
    )
  }
)
