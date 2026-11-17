import { FooterSocial } from "../FooterSocial"
import { BlockTitle, blockHeadingId } from "./shared"
import type { BlockProps } from "./shared"

/** The shop's profiles (its store details' `same_as`), drawn the way the footer's `social` says. */
export function SocialBlock({ block, shop, t, editor }: BlockProps<"social">) {
  const style = shop.footerBar?.social ?? "text"
  if (style === "hidden") {
    return null
  }
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
      <FooterSocial profiles={block.profiles} style={style} label={t("footer.social")} />
    </section>
  )
}
