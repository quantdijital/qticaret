import { createServer } from "node:http"
import type { Server } from "node:http"
import type { AddressInfo } from "node:net"
import {
  MemoryNonceStore,
  privateKeyFromSeed,
  rawPublicKey,
  signDocument,
  signerFromPrivateKey,
  verifySignedRequest,
} from "@qticaret/server-kit"
import type { Ed25519Signer } from "@qticaret/server-kit"
import {
  PLAN_DOCUMENT_PURPOSE,
  PLAN_PULL_PURPOSE,
  planPullBinding,
} from "@qticaret/types/control-plane"
import type { PlanDocument, SignedPlanDocument } from "@qticaret/types/control-plane"
import {
  TENANT_ID,
  TEST_ONLY_CP_SEED,
  TEST_ONLY_TENANT_SEED,
  planDocument,
} from "@qticaret/types/control-plane/testing"

/** The contract's test-only keys (adr/0061 Ek C2): the control plane's and the shop's. */
export const cp = signerFromPrivateKey(privateKeyFromSeed(TEST_ONLY_CP_SEED))
export const shop = signerFromPrivateKey(privateKeyFromSeed(TEST_ONLY_TENANT_SEED))
export const FLAG = "test.platform_sample"

/** The variables that make the shop managed; the control plane's address is closed unless set. */
export const MANAGED_ENV = {
  CONTROL_PLANE_PUBLIC_KEYS: rawPublicKey(cp.privateKey).toString("base64url"),
  TENANT_ID,
  TENANT_SIGNING_KEY: TEST_ONLY_TENANT_SEED.toString("base64url"),
  // Nothing listens here: the control plane is down unless a test says otherwise
  CONTROL_PLANE_URL: "http://127.0.0.1:9",
}

/** Sets `MANAGED_ENV` for a file's tests, and puts the environment back after. */
export function managedForThisFile(): void {
  const saved: Record<string, string | undefined> = {}
  beforeAll(() => {
    for (const [name, value] of Object.entries(MANAGED_ENV)) {
      saved[name] = process.env[name]
      process.env[name] = value
    }
  })
  afterAll(() => {
    for (const [name, value] of Object.entries(saved)) {
      if (value === undefined) {
        Reflect.deleteProperty(process.env, name)
      } else {
        process.env[name] = value
      }
    }
  })
}

export const doc = (serial: number, changes: Partial<PlanDocument> = {}): PlanDocument => ({
  ...planDocument,
  serial,
  platform_flags: { [FLAG]: false },
  ...changes,
})

export const signed = (document: PlanDocument, signer: Ed25519Signer = cp) => ({
  document,
  ...signDocument(PLAN_DOCUMENT_PURPOSE, document, signer),
})

/** A pull's answer as the control plane gives it: the document and its binding to `nonce`. */
export const pullAnswer = (plan: SignedPlanDocument, nonce: string) => ({
  plan,
  binding: signDocument(PLAN_PULL_PURPOSE, planPullBinding(nonce, plan), cp),
})

/**
 * A stand-in control plane for the pull: checks the shop's signed request,
 * then answers `answer(nonce)` with the request's own nonce.
 */
export function fakeControlPlane(answer: (nonce: string) => { status: number; body: unknown }) {
  const nonces = new MemoryNonceStore()
  const seen: string[] = []
  const server = createServer((req, res) => {
    void verifySignedRequest(
      { method: req.method ?? "", path: req.url ?? "", headers: req.headers, body: "" },
      {
        publicKey: (kid, tenantId) =>
          kid === shop.kid && tenantId === TENANT_ID ? shop.privateKey : undefined,
        nonces,
      }
    ).then((verified) => {
      seen.push(verified.ok ? "signed" : verified.code)
      const { status, body } = verified.ok ? answer(verified.nonce) : { status: 401, body: {} }
      res.writeHead(status, { "content-type": "application/json" })
      res.end(JSON.stringify(body))
    })
  })
  return { server, seen }
}

export const listen = (server: Server) =>
  new Promise<string>((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      resolve(`http://127.0.0.1:${String((server.address() as AddressInfo).port)}`)
    })
  })
