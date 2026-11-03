import { startFakeNetgsm } from "../netgsm/fake-server"
import type { FakeNetgsmMessage } from "../netgsm/fake-server"
import { maskedNumber, smsParts } from "../netgsm/parts"
import { stateFileFor } from "./state-file"

/**
 * The local Netgsm for a developer's machine (adr/0036): `pnpm dev:netgsm`,
 * with the backend started as `NETGSM_BASE_URL=http://127.0.0.1:9106`.
 * Every SMS it takes is printed here as the phone would show it, the way
 * Mailpit shows e-mail: the number masked, the sender the shop sent it
 * under, the text and how many SMS it takes. Sender names are the shop's
 * approved ones (`FAKE_NETGSM_SENDERS`); messages and İYS consents are
 * kept in a file between runs.
 *
 * The login is fixed so the panel keeps it between runs, and readable on
 * purpose (docs/04): no scanner takes it for a real one.
 */
const senders = (process.env["FAKE_NETGSM_SENDERS"] ?? "MAGAZA")
  .split(",")
  .map((name) => name.trim().toLocaleUpperCase("tr"))
  .filter(Boolean)

const account = {
  usercode: "8500000000",
  password: "gelistirme-sahte-netgsm-sifresi",
  headers: senders,
  brandCode: "100000",
}

const port = Number(process.env["FAKE_NETGSM_PORT"] ?? 9106)
const stateFile = stateFileFor("netgsm", port)

const KINDS: Record<string, string> = {
  "0": "Bilgilendirme",
  "11": "Ticari (bireysel, İYS denetimli)",
  "12": "Ticari (tacir, İYS denetimli)",
}

function print(message: FakeNetgsmMessage) {
  const count = smsParts(message.text)
  const at = new Date().toLocaleString("tr-TR", { timeZone: "Europe/Istanbul" })
  process.stdout.write(
    [
      `── SMS ${message.jobId} · ${at} ${"─".repeat(20)}`,
      `Kime: ${maskedNumber(message.to)}   Gönderen: ${message.header}   Tür: ${KINDS[message.filter] ?? message.filter}`,
      `Boy: ${String(count.parts)} (${String(count.characters)} karakter, ${count.encoding})`,
      message.text,
      "",
    ].join("\n")
  )
}

void startFakeNetgsm(account, { port, stateFile, onMessage: print }).then((fake) => {
  process.stdout.write(
    [
      `Yerel Netgsm ${fake.url} adresinde.`,
      `Backend .env: NETGSM_BASE_URL=${fake.url}`,
      "Panel > Ayarlar > SMS > Netgsm (panelde test modu yok; bu adres tanımlıyken SMS'ler",
      "buraya gelir ve aşağıda, telefonda görüneceği gibi yazılır):",
      `  Kullanıcı kodu: ${account.usercode}`,
      `  Şifre: ${account.password}`,
      `  Gönderici adı: ${senders.join(" ya da ")}`,
      "    (mağazanın onaylı başlığı için FAKE_NETGSM_SENDERS=BASLIK ile başlatın;",
      "     virgülle birden çok; panelde aynı ad seçili olmalı)",
      `  İYS marka kodu: ${account.brandCode}`,
      `Gelen SMS'ler ve İYS kayıtları yeniden başlatmada korunur: ${stateFile}`,
      "",
    ].join("\n")
  )
})
