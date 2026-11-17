import { fieldMark } from "@qticaret/ui"
import type { FooterBlockView, ShopView, Translate } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"

/** What every free rows footer block is drawn with (adr/0070 §5). */
export interface BlockProps<T extends FooterBlockView["type"]> {
  block: Extract<FooterBlockView, { type: T }>
  shop: ShopView
  t: Translate
  /** The theme editor's live preview: the block's fields carry their marks (`blocks.<at>.<field>`). */
  editor: boolean
}

/** A block's heading's id: its place in the design, unique on the page. */
export const blockHeadingId = (at: number) => `footer-block-${String(at)}`

/** A block field's editor mark (adr/0070 §6): `blocks.<at>.<field>`, only in the editor. */
export const blockMark = (editor: boolean, at: number, field: string) =>
  fieldMark(editor, `blocks.${String(at)}.${field}`)

/** A block's own heading (`h2`: the footer is its own landmark, as the brand columns'). */
export function BlockTitle({
  at,
  editor,
  children,
  className,
}: {
  at: number
  editor: boolean
  children: string
  className?: string | undefined
}) {
  return (
    <h2
      id={blockHeadingId(at)}
      className={cn("text-sm font-semibold tracking-normal text-text", className)}
      {...blockMark(editor, at, "title")}
    >
      {children}
    </h2>
  )
}
