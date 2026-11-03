import { TEST_CARDS } from "../paytr/cards"
import { startFakePaytr } from "../paytr/fake-server"
import { RATE_SNAPSHOT } from "../paytr/rates"
import type { PaytrAccount } from "../paytr/signing"
import { stateFileFor } from "./state-file"

/**
 * The local PayTR for a developer's machine (adr/0028): `pnpm dev:paytr`,
 * with the backend started as `PAYTR_BASE_URL=http://127.0.0.1:9102`.
 * Real PayTR cannot notify localhost, and the first shop's live account
 * would notify the shop's own system. It shows PayTR's card form and the
 * bank's 3-D Secure page, prices installments with the eight programs'
 * rates, and keeps its payments in a file between runs.
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
const stateFile = stateFileFor("paytr", port)

const spaced = (number: string) => number.replace(/(\d{4})(?=\d)/g, "$1 ")
const ANSWERS = { success: "ödenir", refused: "banka onaylamaz", insufficient: "limit yetersiz" }

void startFakePaytr(DEV_PAYTR_ACCOUNT, { port, notifyUrl, rates: RATE_SNAPSHOT, stateFile }).then(
  (fake) => {
    process.stdout.write(
      [
        `Yerel PayTR ${fake.url} adresinde; bildirimler ${notifyUrl} adresine.`,
        `Backend .env: PAYTR_BASE_URL=${fake.url}`,
        "Panel > Ayarlar > Ödeme > PayTR (Test modu KAPALI kalsın: bu adres tanımlıyken ödeme",
        "her durumda buraya gelir; kapalıyken form, siparişteki kart ve ekstre canlıdaki gibi görünür):",
        `  Mağaza no: ${DEV_PAYTR_ACCOUNT.merchantId}`,
        `  Mağaza parolası: ${DEV_PAYTR_ACCOUNT.merchantKey}`,
        `  Mağaza gizli anahtarı: ${DEV_PAYTR_ACCOUNT.merchantSalt}`,
        "Vitrin ödemesi: http://localhost:8000/odeme (kart formu PayTR çerçevesinde)",
        "Kartlar (son kullanma: ileri bir tarih, ör. 12/30; CVV: herhangi 3 hane;",
        "3D Secure şifresi: herhangi 6 hane). Başka geçerli her numara ödenir:",
        ...TEST_CARDS.map(
          (card) => `  ${spaced(card.number)}  ${ANSWERS[card.outcome].padEnd(16)} ${card.note}`
        ),
        "Taksit oranları: 8 kart programı, 2-12 taksit (packages/testing/src/paytr/rates.ts).",
        `Ödemeler ve iadeler yeniden başlatmada korunur: ${stateFile}`,
        "",
      ].join("\n")
    )
  }
)
