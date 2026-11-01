/**
 * The storefront's Content Security Policy (docs/04, adr/0046 §4): scripts
 * only with this request's nonce (and what they load, `strict-dynamic`),
 * nothing framed, no plugins, forms only to ourselves. Pictures may come
 * from any HTTPS host: product images live on the file storage or a CDN.
 * Development relaxes what Next's dev server needs (eval, inline styles,
 * its websocket); a nonce makes browsers ignore 'unsafe-inline', so dev
 * styles go without one.
 */
export function contentSecurityPolicy(nonce: string, development: boolean): string {
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${development ? " 'unsafe-eval'" : ""}`,
    development ? "style-src 'self' 'unsafe-inline'" : `style-src 'self' 'nonce-${nonce}'`,
    `img-src 'self' data: blob: https:${development ? " http:" : ""}`,
    "font-src 'self'",
    `connect-src 'self'${development ? " ws: http://localhost:*" : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(development ? [] : ["upgrade-insecure-requests"]),
  ]
  return directives.join("; ")
}

/** A fresh nonce per response: 128 random bits, base64. */
export function newNonce(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return btoa(String.fromCharCode(...bytes))
}
