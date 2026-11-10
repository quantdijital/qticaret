import { createServer } from "node:net"
import type { AddressInfo } from "node:net"
import { SMTPServer } from "smtp-server"
import type { SMTPServerOptions } from "smtp-server"

/**
 * An SMTP server on 127.0.0.1 for the transport's tests (smtp-server, a
 * development dependency): it keeps each message it takes, raw, and says
 * what a test tells it to at each step. Nothing leaves this machine.
 */

export interface Received {
  from: string
  to: string[]
  raw: string
}

/** An error the server answers with: `550` and its words (`5.1.1 User unknown`). */
export const reply = (code: number, words: string): Error =>
  Object.assign(new Error(words), { responseCode: code })

/**
 * A bare SMTP server written by hand, for byte-exact replies smtp-server
 * would rewrite: it greets, answers EHLO with `ehlo`, takes MAIL FROM and
 * refuses every recipient with a bare `550 User unknown`.
 */
export async function startRawServer(ehlo: string[]) {
  const server = createServer((socket) => {
    socket.write("220 mail.magaza.example ESMTP\r\n")
    let buffered = ""
    socket.on("data", (chunk: Buffer) => {
      buffered += chunk.toString("latin1")
      const lines = buffered.split("\r\n")
      buffered = lines.pop() ?? ""
      for (const line of lines) {
        const verb = line.slice(0, 4).toUpperCase()
        if (verb === "EHLO") {
          socket.write(`${ehlo.join("\r\n")}\r\n`)
        } else if (verb === "MAIL" || verb === "RSET") {
          socket.write("250 OK\r\n")
        } else if (verb === "RCPT") {
          socket.write("550 User unknown\r\n")
        } else if (verb === "QUIT") {
          socket.end("221 Bye\r\n")
        } else {
          socket.write("502 Not implemented\r\n")
        }
      }
    })
    socket.on("error", () => undefined)
  })
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve)
  })
  const { port } = server.address() as AddressInfo
  return {
    port,
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => {
          resolve()
        })
      }),
  }
}

export async function startSmtpServer(options: Partial<SMTPServerOptions> = {}) {
  const received: Received[] = []
  const server = new SMTPServer({
    authOptional: true,
    disabledCommands: ["STARTTLS"],
    disableReverseLookup: true,
    logger: false,
    onData(stream, session, callback) {
      const chunks: Buffer[] = []
      stream.on("data", (chunk: Buffer) => chunks.push(chunk))
      stream.on("end", () => {
        received.push({
          from: session.envelope.mailFrom ? session.envelope.mailFrom.address : "",
          to: session.envelope.rcptTo.map((each) => each.address),
          raw: Buffer.concat(chunks).toString("utf8"),
        })
        callback()
      })
    },
    ...options,
  })
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", resolve)
  })
  const { port } = server.server.address() as AddressInfo
  return {
    port,
    received,
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => {
          resolve()
        })
      }),
  }
}
