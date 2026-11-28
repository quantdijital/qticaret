/**
 * What a "Platform desteği" session may not change inside a settings
 * section it otherwise writes (adr/0061 Ek "Destek erişimi", re-review
 * N-1): the storefront's canonical host drives e-mail links, the
 * e-invoice website, the legal texts' addresses, Turnstile and the
 * sitemap, so it stays the shop's own. Sending the stored value as it is
 * stays allowed, as with the URL style.
 */
export function supportSeoChangeRefused(
  body: Readonly<Record<string, unknown>>,
  stored: Readonly<{ canonical_host: string | null }>
): boolean {
  return Object.hasOwn(body, "canonical_host") && body["canonical_host"] !== stored.canonical_host
}
