import { startFakeGeliver } from "../geliver/fake-server"

/**
 * The fake Geliver for a developer's machine (adr/0031): `pnpm dev:geliver`,
 * with the backend started as `GELIVER_BASE_URL=http://127.0.0.1:9103/api/v1`.
 *
 * The token is fixed so the panel keeps it between runs, and readable on
 * purpose (docs/04): no scanner takes it for a real one, and real Geliver
 * refuses it.
 */
export const DEV_GELIVER_TOKEN = "gelistirme-sahte-geliver-anahtari"

const port = Number(process.env["FAKE_GELIVER_PORT"] ?? 9103)

void startFakeGeliver(DEV_GELIVER_TOKEN, { port }).then((fake) => {
  process.stdout.write(
    [
      `Sahte Geliver ${fake.url} adresinde.`,
      `Backend: GELIVER_BASE_URL=${fake.url}`,
      "Panel > Ayarlar > Kargo > Geliver (test gönderileri açık):",
      `  API anahtarı: ${DEV_GELIVER_TOKEN}`,
      "",
    ].join("\n")
  )
})
