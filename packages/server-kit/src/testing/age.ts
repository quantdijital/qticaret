import type * as Age from "age-encryption" with { "resolution-mode": "import" }

/**
 * Tests only (`@qticaret/server-kit/testing/age`): an age identity made
 * inside a test and dropped with it, and opening what was sealed to it, to
 * prove an escrow round-trip. No application code imports this (a
 * control-plane unit test checks): the control plane holds no identity
 * and cannot open an escrow (adr/0061 §4.3, Ek C8).
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const age = require("age-encryption") as typeof Age

export async function makeTestIdentity(): Promise<{ identity: string; recipient: string }> {
  const identity = await age.generateIdentity()
  return { identity, recipient: await age.identityToRecipient(identity) }
}

export async function openWithTestIdentity(sealed: string, identity: string): Promise<string> {
  const decrypter = new age.Decrypter()
  decrypter.addIdentity(identity)
  return await decrypter.decrypt(age.armor.decode(sealed), "text")
}
