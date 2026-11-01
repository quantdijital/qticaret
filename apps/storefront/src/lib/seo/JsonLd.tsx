import type { JsonLd as Block } from "@qticaret/types"

/**
 * JSON safe inside <script>: `<` (no `</script>`), `>` and `&`, and the
 * line separators JavaScript reads as line ends (docs/13 §3).
 */
export const scriptSafeJson = (value: unknown): string =>
  JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029")

/** The backend's JSON-LD blocks as they are (a theme adds none of its own here). */
export function JsonLd({ blocks }: { blocks: readonly Block[] }) {
  return blocks.map((block, index) => (
    <script
      key={String(index)}
      type="application/ld+json"
      // Escaped by scriptSafeJson: JSON-LD must be the script's raw text
      dangerouslySetInnerHTML={{ __html: scriptSafeJson(block) }}
    />
  ))
}
