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
        // adr/0019, adr/0070 §2: the only source is the backend's `renderDoc(footerDoc)`, the
        // footer's narrowed allow-listed document drawn on the server, every text and address
        // escaped there. Not `content/Prose`: its article type (`gf-prose`) is not the footer's.
        // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml
        dangerouslySetInnerHTML={{ __html: block.html }}
        {...blockMark(editor, block.at, "body")}
      />
    </section>
  )
}
