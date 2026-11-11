/**
 * The provider account keys as an operator sets them (adr/0061 Ek C17).
 * The credentials module reads them from the environment where they are
 * used, so a test changes them in place; `restoreCredentialKeys` puts back
 * what the test environment had.
 */

const saved = {
  list: process.env["CREDENTIALS_ENCRYPTION_KEYS"],
  single: process.env["CREDENTIALS_ENCRYPTION_KEY"],
}

/** `keys` as the list form, newest first; as the single-key form with `single`; none when empty. */
export function useCredentialKeys(keys: readonly string[], single = false): void {
  delete process.env["CREDENTIALS_ENCRYPTION_KEYS"]
  delete process.env["CREDENTIALS_ENCRYPTION_KEY"]
  if (keys.length === 0) {
    return
  }
  if (single) {
    process.env["CREDENTIALS_ENCRYPTION_KEY"] = keys.join(",")
  } else {
    process.env["CREDENTIALS_ENCRYPTION_KEYS"] = keys.join(",")
  }
}

export function restoreCredentialKeys(): void {
  delete process.env["CREDENTIALS_ENCRYPTION_KEYS"]
  delete process.env["CREDENTIALS_ENCRYPTION_KEY"]
  if (saved.list !== undefined) {
    process.env["CREDENTIALS_ENCRYPTION_KEYS"] = saved.list
  }
  if (saved.single !== undefined) {
    process.env["CREDENTIALS_ENCRYPTION_KEY"] = saved.single
  }
}
