/**
 * An old media library's files (adr/0059). WordPress serves one upload
 * under several names: the original, its sizes (`kapak-300x200.jpg`), a
 * large one scaled down (`kapak-scaled.jpg`), an edited copy
 * (`kapak-e1612345678901.jpg`) and a converter plugin's WebP or AVIF
 * beside it (`kapak.jpg.webp`). Their stem is one: the path without them.
 */

const SECOND_EXTENSION = /(\.[a-z0-9]{2,5})\.(?:webp|avif)$/
const EXTENSION = /\.[a-z0-9]{2,5}$/
const VARIANT = /-(?:\d{1,5}x\d{1,5}|scaled|rotated|e\d{10,})$/

/** A file's path without its extension and WordPress's variant suffixes, its folder kept. */
export function uploadStem(path: string): string {
  const slash = path.lastIndexOf("/")
  let name = path
    .slice(slash + 1)
    .replace(SECOND_EXTENSION, "$1")
    .replace(EXTENSION, "")
  // An edited copy has its sizes too: `kapak-e1612345678901-300x200`
  for (let pass = 0; pass < 3 && VARIANT.test(name); pass += 1) {
    name = name.replace(VARIANT, "")
  }
  return `${path.slice(0, slash + 1)}${name}`
}
