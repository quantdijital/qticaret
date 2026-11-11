import { generateKeyPairSync, type KeyObject } from "node:crypto"

/**
 * A public key nobody holds the private half of (made per process, the
 * private half dropped at once). Checked against when no key was found
 * (C9 review L6): a refusal for an unknown key then costs the same
 * verification as one for a wrong signature, so timing does not tell
 * which key ids exist.
 */
export const DUMMY_PUBLIC_KEY: KeyObject = generateKeyPairSync("ed25519").publicKey
