import { randomBytes, randomUUID } from "node:crypto"
import { createServer } from "node:http"
import type { AddressInfo, Socket } from "node:net"

/**
 * A stand-in for Netgsm's SMS service (adr/0036), as its SDK calls it: the
 * XML order (`POST /sms/send/xml`, answered `00 <job id>` or a code) and
 * the sender names (`POST /sms/header`). It keeps what it was sent, so a
 * test reads the message a shopper would get. Its İYS service too (F10
 * M11), as Netgsm's own İYS package calls it: `POST /iys/add` and
 * `/iys/search`, the login and brand code in the body's `header`.
 */

export interface FakeNetgsmAccount {
  usercode: string
  password: string
  /** Sender names registered to the account. */
  headers: string[]
  /** The shop's İYS brand code on the account. */
  brandCode: string
}

/** A consent as İYS took it. */
export interface FakeIysRecord {
  type: string
  source: string
  recipient: string
  status: string
  consentDate: string
  recipientType: string
}

export interface FakeNetgsmMessage {
  jobId: string
  to: string
  text: string
  header: string
  /** 0 information, 11/12 commercial (İYS checked). */
  filter: string
}

export interface FakeNetgsm {
  url: string
  account: FakeNetgsmAccount
  messages: FakeNetgsmMessage[]
  /** Consents sent to İYS, in order. */
  iys: FakeIysRecord[]
  /** The next send answers this code instead (a refusal, a limit). */
  queue: (code: string) => void
  /** The next İYS upload answers this code instead. */
  queueIys: (code: string) => void
  close: () => Promise<void>
}

/** A random account each run: no fixed secret a scanner could take for a real one (docs/04). */
export const fakeNetgsmAccount = (): FakeNetgsmAccount => ({
  usercode: `850${String(Math.floor(1_000_000 + Math.random() * 8_999_999))}`,
  password: randomBytes(10).toString("hex"),
  headers: ["MAGAZA"],
  brandCode: String(Math.floor(100_000 + Math.random() * 899_999)),
})

const IYS_TYPES = ["MESAJ", "ARAMA", "EPOSTA"]

// What İYS checks of a record before taking it
function iysValid(record: Partial<FakeIysRecord>): boolean {
  const recipient = record.recipient ?? ""
  return (
    IYS_TYPES.includes(record.type ?? "") &&
    ["ONAY", "RET"].includes(record.status ?? "") &&
    ["BIREYSEL", "TACIR"].includes(record.recipientType ?? "") &&
    /^HS_[A-Z_0-9]+$/.test(record.source ?? "") &&
    /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(record.consentDate ?? "") &&
    (record.type === "EPOSTA"
      ? /^[^\s@]+@[^\s@]+$/.test(recipient)
      : /^\+905\d{9}$/.test(recipient))
  )
}

const field = (body: string, name: string): string => {
  const raw = new RegExp(`<${name}>([\\s\\S]*?)</${name}>`).exec(body)?.[1] ?? ""
  return raw
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
}

export async function startFakeNetgsm(
  account: FakeNetgsmAccount = fakeNetgsmAccount(),
  options: { port?: number } = {}
): Promise<FakeNetgsm> {
  const messages: FakeNetgsmMessage[] = []
  const iys: FakeIysRecord[] = []
  const queued: string[] = []
  const queuedIys: string[] = []
  const sockets = new Set<Socket>()

  const server = createServer((req, res) => {
    let body = ""
    req.on("data", (chunk: Buffer) => (body += chunk.toString()))
    req.on("end", () => {
      const plain = (text: string) => {
        res.writeHead(200, { "content-type": "text/plain; charset=utf-8" }).end(text)
      }
      if (req.method === "POST" && req.url === "/sms/header") {
        let login: { usercode?: unknown; password?: unknown } = {}
        try {
          login = JSON.parse(body) as typeof login
        } catch {
          plain("70")
          return
        }
        if (login.usercode !== account.usercode || login.password !== account.password) {
          plain("30")
          return
        }
        res
          .writeHead(200, { "content-type": "application/json" })
          .end(JSON.stringify({ code: "00", msgheader: account.headers }))
        return
      }
      if (req.method === "POST" && (req.url === "/iys/add" || req.url === "/iys/search")) {
        const json = (answer: Record<string, unknown>) => {
          res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(answer))
        }
        let order: {
          header?: { username?: unknown; password?: unknown; brandCode?: unknown }
          body?: { data?: Partial<FakeIysRecord>[] }
        } = {}
        try {
          order = JSON.parse(body) as typeof order
        } catch {
          json({ code: "70", error: "Hatalı JSON formatı." })
          return
        }
        if (
          order.header?.username !== account.usercode ||
          order.header.password !== account.password
        ) {
          json({ code: "30", error: "Geçersiz kullanıcı adı, şifre veya API erişim izni yok." })
          return
        }
        if (order.header.brandCode !== account.brandCode) {
          json({ code: "40", error: "Marka kodu hesabınıza tanımlı değil." })
          return
        }
        const data = order.body?.data ?? []
        if (req.url === "/iys/search") {
          const wanted = data[0]
          const found = [...iys]
            .reverse()
            .find((each) => each.type === wanted?.type && each.recipient === wanted.recipient)
          json(
            found
              ? { code: "0", error: false, query: found }
              : { code: "50", error: "Kayıt Bulunamadı." }
          )
          return
        }
        const forced = queuedIys.shift()
        if (forced) {
          json({ code: forced, error: "Zorlanmış hata." })
          return
        }
        const wrong = data.filter((record) => !iysValid(record))
        if (data.length === 0 || wrong.length > 0) {
          json({ code: "70", error: "Hatalı JSON formatı.", erroritem: wrong })
          return
        }
        for (const record of data) {
          iys.push({
            type: record.type ?? "",
            source: record.source ?? "",
            recipient: record.recipient ?? "",
            status: record.status ?? "",
            consentDate: record.consentDate ?? "",
            recipientType: record.recipientType ?? "",
          })
        }
        json({ code: "0", error: false, uid: randomUUID() })
        return
      }
      if (req.method === "POST" && req.url === "/sms/send/xml") {
        if (
          field(body, "usercode") !== account.usercode ||
          field(body, "password") !== account.password
        ) {
          plain("30")
          return
        }
        const header = field(body, "msgheader")
        const forced = queued.shift()
        if (forced) {
          plain(forced)
          return
        }
        if (!account.headers.includes(header)) {
          plain("40")
          return
        }
        const jobId = String(1_000_000_000 + messages.length)
        messages.push({
          jobId,
          to: field(body, "no"),
          text: field(body, "msg"),
          header,
          filter: field(body, "filter"),
        })
        plain(`00 ${jobId}`)
        return
      }
      res.writeHead(404).end()
    })
  })
  server.on("connection", (socket) => {
    sockets.add(socket)
    socket.on("close", () => sockets.delete(socket))
  })
  await new Promise<void>((resolve) => server.listen(options.port ?? 0, "127.0.0.1", resolve))
  const address = server.address() as AddressInfo

  return {
    url: `http://127.0.0.1:${String(address.port)}`,
    account,
    messages,
    iys,
    queue: (code) => {
      queued.push(code)
    },
    queueIys: (code) => {
      queuedIys.push(code)
    },
    close: async () => {
      for (const socket of sockets) {
        socket.destroy()
      }
      await new Promise<void>((resolve) =>
        server.close(() => {
          resolve()
        })
      )
    },
  }
}
