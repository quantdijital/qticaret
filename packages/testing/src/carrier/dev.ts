import type { LabelParty } from "../label-pdf"
import { stateFileFor } from "./tracking"
import type { AdvanceMode } from "./tracking"

/**
 * What the carriers' dev runners (`pnpm dev:aras`, `dev:yurtici`) share:
 * the shop's sender as a contract carrier knows it and the lines that
 * tell the owner how to use the tracking pages.
 */

const env = (name: string): string | undefined => {
  const value = process.env[name]?.trim()
  return value === "" ? undefined : value
}

/**
 * The shop as a contract carrier prints it on the label (it knows the
 * sender from the contract, not from the request): the warehouse
 * `seed:demo` gives (apps/backend/src/scripts/seed/data.ts), or
 * `FAKE_CARRIER_SENDER_NAME`, `_ADDRESS`, `_TOWN`, `_CITY`, `_PHONE`.
 */
export const devSender = (): LabelParty => ({
  name: env("FAKE_CARRIER_SENDER_NAME") ?? "Ana Depo",
  address: env("FAKE_CARRIER_SENDER_ADDRESS") ?? "Caferağa Mahallesi, Moda Caddesi No: 1",
  town: env("FAKE_CARRIER_SENDER_TOWN") ?? "Kadıköy",
  city: env("FAKE_CARRIER_SENDER_CITY") ?? "İstanbul",
  phone: env("FAKE_CARRIER_SENDER_PHONE") ?? "0216 000 00 00",
})

/** The runner's lines on tracking: the page, its buttons, the JSON, how parcels move, the file. */
export function trackingHelp(
  url: string,
  /** The fake's name in its state file: "aras", "yurtici". */
  key: string,
  port: number,
  advance: AdvanceMode
): string[] {
  return [
    `Takip sayfası: ${url}/takip/<takip no> (etiketteki ve paneldeki numara)`,
    advance === "on-read"
      ? "  Otomatik ilerleme açık (FAKE_CARRIER_AUTO_ADVANCE=1): her takip sorgusunda bir adım."
      : "  Gönderi, etiketi alındıktan sonra siz ilerletene kadar yerinde bekler.",
    "  Sayfadaki düğmeler: Kurye aldı · Transfer · Dağıtımda · Teslim edildi",
    `  Komutla: curl -X POST ${url}/takip/<takip no>/ilerle -d adim=kurye-aldi`,
    "    (adim: kurye-aldi, transfer, dagitimda, teslim-edildi; boşsa bir sonraki)",
    `  Durum (JSON): ${url}/takip/<takip no>.json`,
    ...(advance === "manual"
      ? ["  Her sorguda kendiliğinden ilerlesin: FAKE_CARRIER_AUTO_ADVANCE=1 ile başlatın."]
      : []),
    `Gönderiler yeniden başlatınca korunur: ${stateFileFor(key, port)}`,
  ]
}
