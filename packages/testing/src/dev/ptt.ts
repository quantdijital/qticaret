import { devSender, trackingHelp } from "../carrier/dev"
import { advanceModeFromEnv } from "../carrier/tracking"
import { startFakePtt } from "../ptt/fake-server"

/**
 * PTT Kargo's web services on a developer's machine (docs/entegrasyonlar/
 * ptt.md): `pnpm dev:ptt`, with the backend started as
 * `PTT_BASE_URL=http://127.0.0.1:9112`. Parcels wait until a branch
 * accepts them, moved on from the tracking page, and survive a restart.
 * The panel draws the label (PTT gives none).
 *
 * The account is fixed so the panel keeps it between runs, and readable
 * on purpose (docs/04): real PTT refuses it.
 */
const account = { customerId: "900000003", password: "gelistirme-ptt-sifresi" }

const port = Number(process.env["FAKE_PTT_PORT"] ?? 9112)
const advance = advanceModeFromEnv()
const sender = devSender()

void startFakePtt(account, {
  port,
  advance,
  origin: { town: sender.town, city: sender.city },
  persist: true,
}).then((fake) => {
  process.stdout.write(
    [
      `PTT Kargo geliştirme servisi ${fake.url} adresinde.`,
      `Backend: PTT_BASE_URL=${fake.url}`,
      "Panel > Ayarlar > Kargo > PTT Kargo:",
      `  Müşteri numarası: ${account.customerId}`,
      `  Web servis şifresi: ${account.password}`,
      "  Barkod aralığı: örneğin 275036569000 – 275036569999",
      ...trackingHelp(fake.url, "ptt", port, advance).map((line) =>
        line.replace("(etiketteki ve paneldeki numara)", "(etiketteki 13 haneli PTT barkodu)")
      ),
      "",
    ].join("\n")
  )
})
