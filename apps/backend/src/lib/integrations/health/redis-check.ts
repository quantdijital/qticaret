import { connect as connectTcp, isIP } from "node:net"
import type { Socket } from "node:net"
import { connect as connectTls } from "node:tls"
import type { CheckOutcome, IntegrationHealthCheck } from "./health"

/**
 * Redis reachability without a client library: AUTH when the URL carries a
 * password, then PING, over plain TCP (`redis://`) or TLS (`rediss://`).
 * Medusa does not expose its own connection; ioredis arrives with S3's rate
 * limiter and can replace this then.
 */

const command = (...parts: string[]): string =>
  `*${String(parts.length)}\r\n${parts.map((part) => `$${String(Buffer.byteLength(part))}\r\n${part}\r\n`).join("")}`

function open(url: URL): Socket {
  const port = Number(url.port === "" ? 6379 : url.port)
  const host = url.hostname.replace(/^\[(.*)\]$/, "$1")
  if (url.protocol !== "rediss:") {
    return connectTcp({ host, port })
  }
  // SNI carries host names only; an IP address is verified without it
  return connectTls({ host, port, ...(isIP(host) === 0 ? { servername: host } : {}) })
}

/** Sends the commands and resolves with one reply line per command. */
function exchange(url: URL, commands: string[], signal: AbortSignal): Promise<string[]> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new Error("timeout"))
      return
    }
    const socket = open(url)
    let buffer = ""
    const finish = (error?: Error, lines?: string[]) => {
      signal.removeEventListener("abort", onAbort)
      socket.destroy()
      if (error) {
        reject(error)
      } else {
        resolve(lines ?? [])
      }
    }
    const onAbort = () => {
      finish(new Error("timeout"))
    }
    signal.addEventListener("abort", onAbort, { once: true })
    socket.once(url.protocol === "rediss:" ? "secureConnect" : "connect", () => {
      socket.write(commands.join(""))
    })
    socket.on("data", (chunk: Buffer) => {
      buffer += chunk.toString("utf8")
      const lines = buffer.split("\r\n").slice(0, -1)
      // An error reply ends the exchange early: later commands get none
      if (lines.length >= commands.length || lines.some((line) => line.startsWith("-"))) {
        finish(undefined, lines)
      }
    })
    socket.on("error", (error) => {
      finish(error)
    })
    socket.on("close", () => {
      finish(new Error("connection closed"))
    })
  })
}

function outcomeOf(lines: string[]): CheckOutcome {
  const failed = lines.find((line) => line.startsWith("-"))
  if (failed !== undefined) {
    return {
      status: "down",
      reason: /NOAUTH|WRONGPASS|invalid password/i.test(failed) ? "auth_failed" : "error_reply",
    }
  }
  return lines.at(-1) === "+PONG"
    ? { status: "ok" }
    : { status: "down", reason: "unexpected_reply" }
}

export function redisHealthCheck(redisUrl: string | undefined): IntegrationHealthCheck {
  return {
    id: "redis",
    kind: "cache",
    check: async (signal) => {
      if (redisUrl === undefined) {
        return { status: "not_configured" }
      }
      const url = new URL(redisUrl)
      const password = decodeURIComponent(url.password)
      const username = decodeURIComponent(url.username)
      const commands = [
        ...(password === ""
          ? []
          : [username === "" ? command("AUTH", password) : command("AUTH", username, password)]),
        command("PING"),
      ]
      try {
        return outcomeOf(await exchange(url, commands, signal))
      } catch {
        return { status: "down", reason: signal.aborted ? "timeout" : "connection_failed" }
      }
    },
  }
}
