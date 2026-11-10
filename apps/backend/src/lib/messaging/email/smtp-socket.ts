import { connect } from "node:net"
import type { Socket } from "node:net"
import type { ServerFacts } from "./smtp-errors"
import type { SmtpTarget } from "./smtp-target"

/**
 * The connection nodemailer is handed (its `getSocket` option): a TCP
 * socket we open to the address `smtp-target.ts` allowed, so no lookup of
 * nodemailer's decides where it goes, and that we can destroy when a send
 * is given up (an aborted test must not still go out). nodemailer upgrades
 * it to TLS itself, against the typed name (`servername`).
 *
 * While the conversation is still in plain text (STARTTLS before its
 * upgrade, or a loopback relay), the server's EHLO reply is read alongside
 * nodemailer, only to learn whether it lists ENHANCEDSTATUSCODES
 * (`ServerFacts`, security review M2). Nothing of it is kept or logged.
 */

type Callback = (error: Error | null, socketOptions?: { connection: Socket }) => void

export interface PinnedConnection {
  getSocket: (options: unknown, callback: Callback) => void
  facts: ServerFacts
  /** Ends every socket this send opened. */
  destroy: () => void
}

const SNIFF_LIMIT = 8 * 1024

/** Reads the greeting and the EHLO reply; stops at the reply's last line or the limit. */
function sniffEhlo(socket: Socket, facts: ServerFacts): void {
  let buffered = ""
  let seen = 0
  const stop = () => {
    socket.removeListener("data", read)
  }
  function read(chunk: Buffer) {
    seen += chunk.length
    buffered += chunk.toString("latin1")
    const lines = buffered.split("\r\n")
    buffered = lines.pop() ?? ""
    for (const line of lines) {
      // The EHLO reply: 250-… lines, then a last "250 " line
      if (/^250[ -]/.test(line) && /ENHANCEDSTATUSCODES/i.test(line)) {
        facts.enhancedCodes = true
      }
      if (line.startsWith("250 ")) {
        facts.enhancedCodes ??= false
        stop()
        return
      }
    }
    if (seen > SNIFF_LIMIT) {
      stop()
    }
  }
  socket.on("data", read)
}

export function pinnedConnection(
  target: SmtpTarget,
  port: number,
  { timeoutMs, plain }: { timeoutMs: number; plain: boolean }
): PinnedConnection {
  const sockets = new Set<Socket>()
  const facts: ServerFacts = { enhancedCodes: null }
  return {
    facts,
    getSocket: (_options, callback) => {
      let settled = false
      const socket = connect({ host: target.address, port })
      sockets.add(socket)
      const timer = setTimeout(() => {
        socket.destroy(Object.assign(new Error("connect timeout"), { code: "ETIMEDOUT" }))
      }, timeoutMs)
      timer.unref()
      const fail = (error: Error) => {
        clearTimeout(timer)
        if (!settled) {
          settled = true
          callback(error)
        }
      }
      socket.once("error", fail)
      socket.once("connect", () => {
        clearTimeout(timer)
        socket.removeListener("error", fail)
        settled = true
        if (plain) {
          sniffEhlo(socket, facts)
        }
        callback(null, { connection: socket })
      })
    },
    destroy: () => {
      for (const socket of sockets) {
        socket.destroy()
      }
    },
  }
}
