import { FoldSummary, LinkList } from "../FooterParts"
import { BlockTitle, blockHeadingId } from "./shared"
import type { BlockProps } from "./shared"

/**
 * A footer menu (adr/0070 §2.3: the shop's footer menu at the block's
 * order), a `nav` named by its heading. Closed on a phone and a tablet
 * when the shop asked (`collapsePhone`): a 52 px row that opens in place,
 * betiksiz (`details`); from 1024 px always open, as the brand columns'
 * link columns are. Only one of the two is displayed.
 */
export function MenuBlock({ block, editor }: BlockProps<"menu">) {
  const id = blockHeadingId(block.at)
  const open = (
    <nav
      aria-labelledby={id}
      className={block.collapsePhone ? "flex flex-col gap-3 max-lg:hidden" : "flex flex-col gap-3"}
    >
      <BlockTitle at={block.at} editor={editor}>
        {block.title}
      </BlockTitle>
      <LinkList links={block.links} />
    </nav>
  )
  if (!block.collapsePhone) {
    return open
  }
  return (
    <>
      {open}
      <details className="group border-y border-rule lg:hidden">
        <FoldSummary>
          <span id={`${id}-fold`}>{block.title}</span>
        </FoldSummary>
        <nav aria-labelledby={`${id}-fold`} className="pb-3">
          <LinkList links={block.links} />
        </nav>
      </details>
    </>
  )
}
