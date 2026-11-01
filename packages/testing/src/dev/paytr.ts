import { startFakePaytr } from "../paytr/fake-server"
import type { PaytrAccount } from "../paytr/signing"

/**
 * The fake PayTR for a developer's machine (adr/0028): `pnpm dev:paytr`,
 * with the backend started as `PAYTR_BASE_URL=http://127.0.0.1:9102`.
 * Real PayTR cannot notify localhost, and the first shop's live account
 * would notify the shop's own system.
 *
 * The account is fixed so the panel keeps it between runs, and readable on
 * purpose (docs/04): no scanner takes it for a real one, and real PayTR
 * refuses it.
 */
export const DEV_PAYTR_ACCOUNT: PaytrAccount = {
  merchantId: "100001",
  merchantKey: "gelistirme-sahte-anahtar",
  merchantSalt: "gelistirme-sahte-tuz",
}

const port = Number(process.env["FAKE_PAYTR_PORT"] ?? 9102)
const notifyUrl = process.env["PAYTR_NOTIFY_URL"] ?? "http://localhost:9000/hooks/paytr"

void startFakePaytr(DEV_PAYTR_ACCOUNT, { port, notifyUrl }).then((fake) => {
  process.stdout.write(
    [
      `Sahte PayTR ${fake.url} adresinde; bildirimler ${notifyUrl} adresine.`,
      `Backend: PAYTR_BASE_URL=${fake.url}`,
      "Panel > Ayarlar > Ödeme > PayTR (test modu açık):",
      `  Mağaza no: ${DEV_PAYTR_ACCOUNT.merchantId}`,
      `  Mağaza parolası: ${DEV_PAYTR_ACCOUNT.merchantKey}`,
      `  Mağaza gizli anahtarı: ${DEV_PAYTR_ACCOUNT.merchantSalt}`,
      "Vitrin ödemesi: http://localhost:8000/odeme (kartla ödeme PayTR çerçevesinde)",
      "",
    ].join("\n")
  )
})
