import { Blockquote } from "@tiptap/extension-blockquote"
import { Image } from "@tiptap/extension-image"
import { ListItem } from "@tiptap/extension-list"
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table"
import { Placeholder } from "@tiptap/extensions"
import { StarterKit } from "@tiptap/starter-kit"
import { CategoryCard, ProductCard } from "./card-nodes"
import { isSafeHref, isShortHref } from "./href"

/**
 * The editor's schema, held to the server's allowlist (adr/0019): headings
 * h2–h4, bold, italic, links, lists, quotes, tables, images and cards; no
 * code, strike, underline or rule. Quotes and list items hold paragraphs and
 * lists only, table cells paragraphs, as the server checks. Without `media`
 * (a product's description, ADR-0055) there are no pictures and no cards.
 * A `short` text (a product's short description, ADR-0055 Ek 2026-11-06)
 * takes h3–h4 only, no quotes, tables, pictures or cards, and links to the
 * shop or https only.
 */
export function contentExtensions(placeholder: string, { media = true, short = false } = {}) {
  return [
    StarterKit.configure({
      heading: { levels: short ? [3, 4] : [2, 3, 4] },
      code: false,
      codeBlock: false,
      strike: false,
      underline: false,
      horizontalRule: false,
      blockquote: false,
      listItem: false,
      link: {
        openOnClick: false,
        autolink: true,
        defaultProtocol: "https",
        protocols: ["http", "https"],
        isAllowedUri: (url) => (short ? isShortHref(url) : isSafeHref(url)),
        HTMLAttributes: { rel: null, target: null },
      },
    }),
    ListItem.extend({ content: "paragraph (bulletList | orderedList)*" }),
    ...(short
      ? []
      : [
          Blockquote.extend({ content: "(paragraph | bulletList | orderedList)+" }),
          Table.configure({ resizable: false }),
          TableRow,
          TableHeader.extend({ content: "paragraph+" }),
          TableCell.extend({ content: "paragraph+" }),
        ]),
    ...(media && !short
      ? [Image.configure({ inline: false, allowBase64: false }), ProductCard, CategoryCard]
      : []),
    Placeholder.configure({ placeholder }),
  ]
}
