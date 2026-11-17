import { BrandBlock as Brand } from "../FooterParts"
import { blockHeadingId, blockMark } from "./shared"
import type { BlockProps } from "./shared"

/**
 * The shop's logo (or name), its own short line and, when the block asks,
 * its profiles: the brand columns' brand block without the address and
 * the identity lines (the legal strip below the rows says those).
 */
export function BrandBlock({ block, shop, t, editor }: BlockProps<"brand">) {
  return (
    <Brand
      shop={shop}
      t={t}
      about={block.about}
      withContact={false}
      block={{
        logo: block.logo,
        profiles: block.social,
        headingId: blockHeadingId(block.at),
        aboutMark: blockMark(editor, block.at, "about"),
      }}
    />
  )
}
