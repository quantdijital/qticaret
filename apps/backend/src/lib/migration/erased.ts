import { hashPii, parseKey } from "@qticaret/server-kit"
import { parseEnv } from "../env"

/**
 * A moved customer erased here (KVKK, F13.5): their migration record keeps
 * no key that names them, only this keyed digest of it, so a migration run
 * again knows them and does not bring them back (F14 closing review).
 */
export const erasedKeyOf = (sourceKey: string): string =>
  `erased:${hashPii(sourceKey, parseKey(parseEnv().PII_HASH_KEY, "PII_HASH_KEY"), "migration.erased")}`
