import { createServer } from "node:http"
import type { IncomingHttpHeaders, Server } from "node:http"
import { MemoryNonceStore, verifySignedRequest } from "@qticaret/server-kit"
import {
  AI_CALL_RESPONSE_HEADERS,
  AI_CREDITS_PATHS,
  AI_GATEWAY_REFUSALS,
} from "@qticaret/types/control-plane"
import type { AiCreditsStatus, AiGatewayRefusalCode } from "@qticaret/types/control-plane"
import { TENANT_ID } from "@qticaret/types/control-plane/testing"
import { shop } from "./control-plane"

/**
 * A stand-in control plane for the platform's credits (adr/0085, P4b-1):
 * the status route and the call route, each verifying the shop's
 * signature over the very path and bytes it got. It records what came
 * and answers in turn what the test queued (an answer passed on from a
 * provider, or the gateway's own refusal). Nothing leaves the machine.
 */

export interface GatewayCall {
  path: string
  query: URLSearchParams
  headers: IncomingHttpHeaders
  body: string
  signed: boolean
}

export interface GatewayAnswer {
  status: number
  headers: Record<string, string>
  body: string
}

/** An SEO title the gate passes for `aiProduct`'s product. */
export const GATED_TITLE = "Yazlık Keten Gömlek, Rahat ve Nefes Alan Kesim"

/** The status of credits that can be used now, routing text to `deepseek`. */
export const availableStatus = (services: Record<string, string> = { text: "deepseek" }) =>
  ({
    available: true,
    balance: {
      plan: { remaining: 40, renews_on: "2026-12-01" },
      purchased: { remaining: 0, expires_on: null },
    },
    daily: { cap: 300, remaining: 300 },
    services,
    table: { seo_title: 1, assistant: 3 },
    packs: [],
    pending_order: null,
  }) satisfies AiCreditsStatus

const passed = (body: unknown, credits = 1, balance = 39): GatewayAnswer => ({
  status: 200,
  headers: {
    "content-type": "application/json",
    [AI_CALL_RESPONSE_HEADERS.charged]: String(credits),
    [AI_CALL_RESPONSE_HEADERS.balance]: String(balance),
  },
  body: JSON.stringify(body),
})

/** A chat answer passed on: its text, or a tool call (the assistant's loop). */
export const chatAnswer = (content: string, credits = 1): GatewayAnswer =>
  passed(
    {
      choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
      usage: { prompt_tokens: 12, completion_tokens: 6 },
    },
    credits
  )

export const toolCallAnswer = (name: string, args: Record<string, unknown>): GatewayAnswer =>
  passed(
    {
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: "call_1",
                type: "function",
                function: { name, arguments: JSON.stringify(args) },
              },
            ],
          },
          finish_reason: "tool_calls",
        },
      ],
      usage: { prompt_tokens: 12, completion_tokens: 6 },
    },
    3
  )

/** The gateway's own refusal: the envelope, the header naming the same code. */
export const refusalAnswer = (code: AiGatewayRefusalCode): GatewayAnswer => ({
  status: AI_GATEWAY_REFUSALS[code],
  headers: { "content-type": "application/json", [AI_CALL_RESPONSE_HEADERS.refusal]: code },
  body: JSON.stringify({ qt_ai_gateway: { code } }),
})

export function fakeAiGateway() {
  const nonces = new MemoryNonceStore()
  const calls: GatewayCall[] = []
  const state: {
    status: AiCreditsStatus
    statusAsks: number
    answers: GatewayAnswer[]
    fallback: GatewayAnswer
  } = {
    status: availableStatus(),
    statusAsks: 0,
    answers: [],
    // A title the SEO gate takes (ai-seo.spec.ts)
    fallback: chatAnswer(GATED_TITLE),
  }

  const server: Server = createServer((req, res) => {
    const chunks: Buffer[] = []
    req.on("data", (chunk: Buffer) => chunks.push(chunk))
    req.on("end", () => {
      const body = Buffer.concat(chunks)
      const target = req.url ?? ""
      void verifySignedRequest(
        { method: req.method ?? "", path: target, headers: req.headers, body },
        {
          publicKey: (kid, tenantId) =>
            kid === shop.kid && tenantId === TENANT_ID ? shop.privateKey : undefined,
          nonces,
        }
      ).then((verified) => {
        const url = new URL(target, "http://gateway.test")
        let answer: GatewayAnswer
        if (url.pathname === AI_CREDITS_PATHS.credits) {
          state.statusAsks += 1
          answer = { status: 200, headers: {}, body: JSON.stringify(state.status) }
        } else if (url.pathname !== AI_CREDITS_PATHS.calls) {
          // The shop's other control plane traffic (a plan pull, a usage report): not this test's
          answer = { status: 404, headers: {}, body: "{}" }
        } else {
          calls.push({
            path: url.pathname,
            query: url.searchParams,
            headers: req.headers,
            body: body.toString("utf8"),
            signed: verified.ok,
          })
          answer = state.answers.shift() ?? state.fallback
        }
        if (!verified.ok) {
          answer = { status: 401, headers: {}, body: "{}" }
        }
        res.writeHead(answer.status, { "content-type": "application/json", ...answer.headers })
        res.end(answer.body)
      })
    })
  })
  return { server, calls, state }
}
