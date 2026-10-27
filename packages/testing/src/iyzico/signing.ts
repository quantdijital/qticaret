import { createHmac } from "node:crypto"
import { fakeSecret } from "../paytr/signing"

/**
 * iyzico's IYZWSv2 as docs.iyzico.com writes it, kept apart from the
 * backend's own (`lib/payments/iyzico/signatures.ts`) on purpose: the fake
 * server checks the client against the documentation, not against itself.
 */

export interface IyzicoAccount {
  apiKey: string
  secretKey: string
}

/** A sandbox account for one test run: iyzico's sandbox keys start with "sandbox-". */
export const fakeIyzicoAccount = (): IyzicoAccount => ({
  apiKey: `sandbox-${fakeSecret()}`,
  secretKey: `sandbox-${fakeSecret()}`,
})

export const iyzicoSign = (secretKey: string, randomKey: string, path: string, body: string) =>
  createHmac("sha256", secretKey)
    .update(randomKey + path + body)
    .digest("hex")

/** The parts of an `IYZWSv2` Authorization header; null when it is not one. */
export function readAuthorization(
  header: string | undefined
): { apiKey: string; randomKey: string; signature: string } | null {
  if (!header?.startsWith("IYZWSv2 ")) {
    return null
  }
  const decoded = Buffer.from(header.slice("IYZWSv2 ".length), "base64").toString("utf8")
  const parts =
    /^apiKey:(?<apiKey>.+)&randomKey:(?<randomKey>.+)&signature:(?<signature>[0-9a-f]{64})$/.exec(
      decoded
    )?.groups
  return parts?.["apiKey"] && parts["randomKey"] && parts["signature"]
    ? { apiKey: parts["apiKey"], randomKey: parts["randomKey"], signature: parts["signature"] }
    : null
}
