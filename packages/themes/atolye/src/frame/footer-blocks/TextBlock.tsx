import { BlockTitle, blockHeadingId, blockMark } from "./shared"
import type { BlockProps } from "./shared"

/**
 * The shop's fixed words ("Sabit yazı"): its heading when it gave one,
 * then the backend's HTML from the footer's narrowed document (paragraphs,
 * lists, bold, italic, links; adr/0070 §2), in the footer's small measure.
 */
export function TextBlock({ block, editor }: BlockProps<"text">) {
  return (
    <section
      {...(block.title ? { "aria-labelledby": blockHeadingId(block.at) } : {})}
      className="flex flex-col gap-3"
    >
      {block.title && (
        <BlockTitle at={block.at} editor={editor}>
          {block.title}
        </BlockTitle>
      )}
      <div
        className="gf-foot-prose"
        // adr/0019: built by the backend from an allow-listed document schema
        dangerouslySetInnerHTML={{ __html: block.html }}
        {...blockMark(editor, block.at, "body")}
      />
    </section>
  )
}
