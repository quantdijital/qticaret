import { randomBytes } from "node:crypto"
import {
  ENVELOPE_VERSION,
  isSerializedEnvelope,
  needsRewrap,
  openEnvelope,
  openEnvelopeText,
  parseEnvelope,
  rewrapEnvelope,
  sealEnvelope,
  serializeEnvelope,
} from "../envelope"
import type { Envelope } from "../envelope"
import { EnvelopeError, createLocalKeyWrapper, kekFingerprint, parseKekList } from "../key-wrapper"

const oldKek = randomBytes(32)
const newKek = randomBytes(32)
const CONTEXT = { owner: "platform", name: "cp_signing_key", version: 1 }
const SECRET = "ed25519-seed-value"

const rejectsWith = async (promise: Promise<unknown>, code: string): Promise<void> => {
  await expect(promise).rejects.toBeInstanceOf(EnvelopeError)
  await expect(promise).rejects.toMatchObject({ code })
}

describe("sealEnvelope / openEnvelope", () => {
  const wrapper = createLocalKeyWrapper([oldKek])

  it("round-trips and never holds the plaintext", async () => {
    const envelope = await sealEnvelope(SECRET, CONTEXT, wrapper)

    expect(envelope.version).toBe(ENVELOPE_VERSION)
    expect(envelope.kekId).toBe(kekFingerprint(oldKek))
    expect(serializeEnvelope(envelope)).not.toContain(SECRET)
    expect(envelope.ciphertext.toString("utf8")).not.toContain(SECRET)
    expect(await openEnvelopeText(envelope, CONTEXT, wrapper)).toBe(SECRET)
  })

  it("gives every record its own data key", async () => {
    const one = await sealEnvelope(SECRET, CONTEXT, wrapper)
    const two = await sealEnvelope(SECRET, CONTEXT, wrapper)

    expect(one.wrappedKey.equals(two.wrappedKey)).toBe(false)
    expect(one.ciphertext.equals(two.ciphertext)).toBe(false)
  })

  it.each([
    ["another owner", { ...CONTEXT, owner: "ten_other" }],
    ["another name", { ...CONTEXT, name: "smtp_password" }],
    ["another version", { ...CONTEXT, version: 2 }],
    ["an extra field", { ...CONTEXT, extra: "x" }],
  ])("does not open with %s (wrong AAD)", async (_case, context) => {
    const envelope = await sealEnvelope(SECRET, CONTEXT, wrapper)

    await rejectsWith(openEnvelope(envelope, context, wrapper), "envelope.open_failed")
  })

  it("binds the wrapped data key to the record: another record's key does not open it", async () => {
    const one = await sealEnvelope(SECRET, CONTEXT, wrapper)
    const other = await sealEnvelope("other", { ...CONTEXT, name: "other" }, wrapper)

    await rejectsWith(
      openEnvelope({ ...one, wrappedKey: other.wrappedKey }, CONTEXT, wrapper),
      "envelope.open_failed"
    )
  })

  it("refuses an unknown kid and a kid swapped for another known KEK", async () => {
    const envelope = await sealEnvelope(SECRET, CONTEXT, wrapper)
    const both = createLocalKeyWrapper([newKek, oldKek])

    await rejectsWith(
      openEnvelope({ ...envelope, kekId: "0123456789abcdef" }, CONTEXT, wrapper),
      "envelope.unknown_kek"
    )
    await rejectsWith(
      openEnvelope({ ...envelope, kekId: kekFingerprint(newKek) }, CONTEXT, both),
      "envelope.open_failed"
    )
  })

  it("refuses a wrong KEK and tampered ciphertext", async () => {
    const envelope = await sealEnvelope(SECRET, CONTEXT, wrapper)
    const tampered = Buffer.from(envelope.ciphertext)
    tampered[tampered.length - 1] = (tampered[tampered.length - 1] ?? 0) ^ 1

    await rejectsWith(
      openEnvelope(envelope, CONTEXT, createLocalKeyWrapper([newKek])),
      "envelope.unknown_kek"
    )
    await rejectsWith(
      openEnvelope({ ...envelope, ciphertext: tampered }, CONTEXT, wrapper),
      "envelope.open_failed"
    )
  })

  it("needs a context", async () => {
    await rejectsWith(sealEnvelope(SECRET, {}, wrapper), "envelope.context_required")
  })
})

describe("KEK rotation", () => {
  it("re-wraps the data key under the new KEK and keeps the ciphertext", async () => {
    const before = await sealEnvelope(SECRET, CONTEXT, createLocalKeyWrapper([oldKek]))
    const rotating = createLocalKeyWrapper([newKek, oldKek])

    expect(needsRewrap(before, rotating)).toBe(true)
    expect(await openEnvelopeText(before, CONTEXT, rotating)).toBe(SECRET)

    const { envelope: after, changed } = await rewrapEnvelope(before, CONTEXT, rotating)
    expect(changed).toBe(true)
    expect(after.kekId).toBe(kekFingerprint(newKek))
    expect(after.ciphertext.equals(before.ciphertext)).toBe(true)

    // The old KEK can go once every record is re-wrapped
    const rotated = createLocalKeyWrapper([newKek])
    expect(await openEnvelopeText(after, CONTEXT, rotated)).toBe(SECRET)
    expect(await rewrapEnvelope(after, CONTEXT, rotated)).toEqual({
      envelope: after,
      changed: false,
    })
  })

  it("does not re-wrap under a wrong AAD", async () => {
    const before = await sealEnvelope(SECRET, CONTEXT, createLocalKeyWrapper([oldKek]))

    await rejectsWith(
      rewrapEnvelope(before, { ...CONTEXT, version: 9 }, createLocalKeyWrapper([newKek, oldKek])),
      "envelope.open_failed"
    )
  })

  it("refuses a KEK of the wrong size, a repeated one and none", () => {
    expect(() => createLocalKeyWrapper([randomBytes(16)])).toThrow(EnvelopeError)
    expect(() => createLocalKeyWrapper([oldKek, Buffer.from(oldKek)])).toThrow(EnvelopeError)
    expect(() => createLocalKeyWrapper([])).toThrow(EnvelopeError)
  })

  it("reads a key list newest first without echoing a value", () => {
    const keys = parseKekList(` ${newKek.toString("hex")} , ${oldKek.toString("hex")}`, "KEYS")

    expect(createLocalKeyWrapper(keys).kekId).toBe(kekFingerprint(newKek))
    expect(() => parseKekList("not-a-key", "KEYS")).toThrow(/^KEYS must be 32 bytes/)
    expect(() => parseKekList(" , ", "KEYS")).toThrow("KEYS must list at least one key")
  })
})

describe("serialised form", () => {
  it("round-trips through one text value", async () => {
    const wrapper = createLocalKeyWrapper([oldKek])
    const text = serializeEnvelope(await sealEnvelope(SECRET, CONTEXT, wrapper))

    expect(text).toMatch(/^qtenv1\.[0-9a-f]{16}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/)
    expect(await openEnvelopeText(parseEnvelope(text), CONTEXT, wrapper)).toBe(SECRET)
  })

  it("tells the envelope form from an older stored format", async () => {
    const wrapper = createLocalKeyWrapper([oldKek])
    const text = serializeEnvelope(await sealEnvelope(SECRET, CONTEXT, wrapper))

    expect(isSerializedEnvelope(text)).toBe(true)
    // A later version is still an envelope: parseEnvelope names it unsupported
    expect(isSerializedEnvelope("qtenv2.abc.AAAA.AAAA")).toBe(true)
    // adr/0027's blob: standard base64, never a dot
    expect(isSerializedEnvelope(randomBytes(48).toString("base64"))).toBe(false)
    expect(isSerializedEnvelope("qtenvelope")).toBe(false)
    expect(isSerializedEnvelope("")).toBe(false)
  })

  it.each([
    ["another version", "qtenv2.abc.AAAA.AAAA", "envelope.unsupported_version"],
    ["a missing part", "qtenv1.abc.AAAA", "envelope.malformed"],
    ["an extra part", "qtenv1.abc.AAAA.AAAA.AAAA", "envelope.malformed"],
    ["a bad kid", "qtenv1.a+b.AAAA.AAAA", "envelope.malformed"],
    ["not base64url", "qtenv1.abc.AA=A.AAAA", "envelope.malformed"],
    ["something else", "plain text", "envelope.malformed"],
  ])("refuses %s", (_case, text, code) => {
    expect(() => parseEnvelope(text)).toThrow(expect.objectContaining({ code }) as Error)
  })

  it("refuses a truncated ciphertext before unwrapping", async () => {
    const wrapper = createLocalKeyWrapper([oldKek])
    const envelope: Envelope = await sealEnvelope(SECRET, CONTEXT, wrapper)

    await rejectsWith(
      openEnvelope({ ...envelope, ciphertext: Buffer.alloc(8) }, CONTEXT, wrapper),
      "envelope.malformed"
    )
  })
})
