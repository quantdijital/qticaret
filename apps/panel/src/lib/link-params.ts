let taken: { path: string; params: URLSearchParams } | null = null

/**
 * What a one-time link carries after `#` (an invitation's or a reset's
 * token): a fragment never reaches a server's logs or another site's
 * Referer. Read once, then taken out of the address bar and the history;
 * read again on the same page, it gives the same values.
 */
export function linkParams(): URLSearchParams {
  const { pathname, search, hash } = window.location
  if (hash.length > 1) {
    taken = { path: pathname, params: new URLSearchParams(hash.slice(1)) }
    // The router keeps its own entry in the history state: kept as it is
    window.history.replaceState(window.history.state, "", `${pathname}${search}`)
  }
  return taken?.path === pathname ? taken.params : new URLSearchParams()
}
