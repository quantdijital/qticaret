/**
 * The server's link rule (adr/0019, `lib/content/doc.ts`), so the editor
 * refuses what the save would: http(s) elsewhere, or a path on the shop.
 */

const ABSOLUTE = /^https?:\/\/[^\s/$.?#][^\s]*$/i
const SITE_PATH = /^\/(?!\/)[^\s\\]*$/
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u001f\u007f]/

export function isSafeHref(href: string): boolean {
  const value = href.trim()
  return (
    value.length > 0 &&
    value.length <= 2048 &&
    !CONTROL.test(value) &&
    (SITE_PATH.test(value) || ABSOLUTE.test(value))
  )
}
