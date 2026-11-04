const MAX_URL_LENGTH = 2048

/**
 * An absolute http(s) address without credentials: our own file storage's,
 * which is plain http on a developer's machine (deployed, `S3_FILE_URL`
 * must be https). Only where the address must also be a known upload.
 */
export const isStorageUrl = (value: string): boolean => {
  if (value.length > MAX_URL_LENGTH || !/^https?:\/\//.test(value)) {
    return false
  }
  try {
    const url = new URL(value)
    return url.username === "" && url.password === ""
  } catch {
    return false
  }
}

/** An absolute https address without credentials in it: never a script, another scheme or `//host`. */
export const isHttpsUrl = (value: string): boolean => {
  if (value.length > MAX_URL_LENGTH || !value.startsWith("https://")) {
    return false
  }
  try {
    const url = new URL(value)
    return url.protocol === "https:" && url.username === "" && url.password === ""
  } catch {
    return false
  }
}
