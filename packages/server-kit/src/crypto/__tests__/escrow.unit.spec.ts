import { Decrypter, armor, generateIdentity, identityToRecipient } from "age-encryption"
import { EscrowError, parseAgeRecipients, sealToAgeRecipients } from "../escrow"

// A test-only identity, made here and dropped with the test (never a fixture)
async function testIdentity(): Promise<{ identity: string; recipient: string }> {
  const identity = await generateIdentity()
  return { identity, recipient: await identityToRecipient(identity) }
}

async function open(sealed: string, identity: string): Promise<string> {
  const decrypter = new Decrypter()
  decrypter.addIdentity(identity)
  return await decrypter.decrypt(armor.decode(sealed), "text")
}

describe("age escrow (adr/0061 §4.3)", () => {
  it("seals to a recipient whose identity alone opens it", async () => {
    const { identity, recipient } = await testIdentity()
    const other = await testIdentity()
    const secret = "JWT_SECRET=0123456789abcdef"

    const sealed = await sealToAgeRecipients(secret, [recipient])

    expect(sealed.startsWith("-----BEGIN AGE ENCRYPTED FILE-----")).toBe(true)
    expect(sealed).not.toContain(secret)
    await expect(open(sealed, identity)).resolves.toBe(secret)
    await expect(open(sealed, other.identity)).rejects.toThrow()
  })

  it("seals to several recipients, each of which opens it", async () => {
    const first = await testIdentity()
    const second = await testIdentity()

    const sealed = await sealToAgeRecipients("x", [first.recipient, second.recipient])

    await expect(open(sealed, first.identity)).resolves.toBe("x")
    await expect(open(sealed, second.identity)).resolves.toBe("x")
  })

  it("parses a list of recipients", async () => {
    const first = await testIdentity()
    const second = await testIdentity()

    expect(parseAgeRecipients(` ${first.recipient}, ${second.recipient}\n`, "R")).toEqual([
      first.recipient,
      second.recipient,
    ])
  })

  it("refuses an identity, naming the variable and never the value", async () => {
    const { identity } = await testIdentity()

    let caught: unknown
    try {
      parseAgeRecipients(identity, "CP_ESCROW_RECIPIENTS")
    } catch (error) {
      caught = error
    }

    expect(caught).toBeInstanceOf(EscrowError)
    expect((caught as EscrowError).code).toBe("escrow.identity_given")
    expect((caught as Error).message).toContain("CP_ESCROW_RECIPIENTS")
    expect((caught as Error).message).not.toContain(identity)
  })

  it("refuses malformed, mis-checksummed, empty and repeated lists", async () => {
    const { recipient } = await testIdentity()
    const flipped = `${recipient.slice(0, -1)}${recipient.endsWith("q") ? "p" : "q"}`

    for (const value of [
      "",
      "ssh-ed25519 AAAA",
      "age1short",
      flipped,
      `${recipient},${recipient}`,
    ]) {
      expect(() => parseAgeRecipients(value, "R")).toThrow(EscrowError)
    }
  })
})
