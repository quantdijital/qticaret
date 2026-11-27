import { BrandBlock as Brand } from "../FooterParts"
import { blockHeadingId, blockMark } from "./shared"
import type { BlockProps } from "./shared"

/**
 * The shop's logo (or name), its own short line and, when the block asks,
 * its address and its profiles: the brand columns' brand block without
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
        logoSize: block.logoSize,
        profiles: block.social,
        address: block.address,
        headingId: blockHeadingId(block.at),
        aboutMark: blockMark(editor, block.at, "about"),
      }}
    />
  )
}
