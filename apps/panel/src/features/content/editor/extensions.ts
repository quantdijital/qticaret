import { Blockquote } from "@tiptap/extension-blockquote"
import { Image } from "@tiptap/extension-image"
import { ListItem } from "@tiptap/extension-list"
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table"
import { Placeholder } from "@tiptap/extensions"
import { StarterKit } from "@tiptap/starter-kit"
import { CategoryCard, ProductCard } from "./card-nodes"
import { isSafeHref } from "./href"

/**
 * The editor's schema, held to the server's allowlist (adr/0019): headings
 * h2–h4, bold, italic, links, lists, quotes, tables, images and cards; no
 * code, strike, underline or rule. Quotes and list items hold paragraphs and
 * lists only, table cells paragraphs, as the server checks. Without `media`
 * (a product's description, ADR-0055) there are no pictures and no cards.
 */
export function contentExtensions(placeholder: string, { media = true } = {}) {
  return [
    StarterKit.configure({
      heading: { levels: [2, 3, 4] },
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
        isAllowedUri: (url) => isSafeHref(url),
        HTMLAttributes: { rel: null, target: null },
      },
    }),
    Blockquote.extend({ content: "(paragraph | bulletList | orderedList)+" }),
    ListItem.extend({ content: "paragraph (bulletList | orderedList)*" }),
    Table.configure({ resizable: false }),
    TableRow,
    TableHeader.extend({ content: "paragraph+" }),
    TableCell.extend({ content: "paragraph+" }),
    ...(media
      ? [Image.configure({ inline: false, allowBase64: false }), ProductCard, CategoryCard]
      : []),
    Placeholder.configure({ placeholder }),
  ]
}
