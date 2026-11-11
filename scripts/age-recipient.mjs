// Prints a fresh age X25519 recipient (`age1…`) whose identity is never kept:
// the local stand-in for the owner's offline escrow key (adr/0061 §4.3, Ek C8).
// What a developer's control plane seals to it can be opened by no one, which
// is right for development data. Dependency-free (node:crypto + BIP-173
// bech32, the encoding age uses), so `pnpm env:init` runs before install.
import { generateKeyPairSync } from "node:crypto"
import { realpathSync } from "node:fs"
import { pathToFileURL } from "node:url"

const CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l"
const GENERATOR = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3]

function polymod(values) {
  let chk = 1
  for (const value of values) {
    const top = chk >>> 25
    chk = ((chk & 0x1ffffff) << 5) ^ value
    for (let i = 0; i < 5; i++) {
      if ((top >>> i) & 1) {
        chk ^= GENERATOR[i]
      }
    }
  }
  return chk
}

const hrpExpand = (hrp) => [
  ...[...hrp].map((c) => c.charCodeAt(0) >>> 5),
  0,
  ...[...hrp].map((c) => c.charCodeAt(0) & 31),
]

function toWords(bytes) {
  const words = []
  let acc = 0
  let bits = 0
  for (const byte of bytes) {
    acc = (acc << 8) | byte
    bits += 8
    while (bits >= 5) {
      bits -= 5
      words.push((acc >>> bits) & 31)
    }
  }
  if (bits > 0) {
    words.push((acc << (5 - bits)) & 31)
  }
  return words
}

export function bech32Encode(hrp, bytes) {
  const words = toWords(bytes)
  const mod = polymod([...hrpExpand(hrp), ...words, 0, 0, 0, 0, 0, 0]) ^ 1
  const checksum = Array.from({ length: 6 }, (_, i) => (mod >>> (5 * (5 - i))) & 31)
  return `${hrp}1${[...words, ...checksum].map((word) => CHARSET[word]).join("")}`
}

export function throwawayRecipient() {
  // The private half goes out of scope here, unexported and unprinted
  const { publicKey } = generateKeyPairSync("x25519")
  const raw = Buffer.from(publicKey.export({ format: "jwk" }).x, "base64url")
  return bech32Encode("age", raw)
}

// Run directly (also from a path with spaces or through a symlink), not imported
const invoked = process.argv[1] ? pathToFileURL(realpathSync(process.argv[1])).href : ""
if (import.meta.url === invoked) {
  process.stdout.write(`${throwawayRecipient()}\n`)
}
