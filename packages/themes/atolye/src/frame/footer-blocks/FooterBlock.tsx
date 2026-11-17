import type { ReactNode } from "react"
import { fieldMark } from "@qticaret/ui"
import type { FooterBlockView, PlaceOrderResult, ShopView, Translate } from "@qticaret/ui"
import { BrandBlock } from "./BrandBlock"
import { ContactBlock } from "./ContactBlock"
import type { FoldJoin } from "./fold-joins"
import { ImageBlock } from "./ImageBlock"
import { MenuBlock } from "./MenuBlock"
import { NewsletterBlock } from "./NewsletterBlock"
import { PaymentsBlock } from "./PaymentsBlock"
import { SocialBlock } from "./SocialBlock"
import { TextBlock } from "./TextBlock"
import { TrustBlock } from "./TrustBlock"

type Subscribe = (state: PlaceOrderResult, form: FormData) => Promise<PlaceOrderResult>

interface Props {
  block: FooterBlockView
  shop: ShopView
  t: Translate
  editor: boolean
  subscribe?: Subscribe | undefined
  /** The column's share of the row (its picture's `sizes`). */
  share: number
  /** A closed menu after another one on a phone: drawn joined to it (`fold-joins.ts`). */
  join?: FoldJoin | undefined
}

function body({ block, shop, t, editor, subscribe, share }: Props): ReactNode {
  const common = { shop, t, editor }
  switch (block.type) {
    case "text":
      return <TextBlock block={block} {...common} />
    case "menu":
      return <MenuBlock block={block} {...common} />
    case "brand":
      return <BrandBlock block={block} {...common} />
    case "newsletter":
      return subscribe ? <NewsletterBlock block={block} {...common} subscribe={subscribe} /> : null
    case "contact":
      return <ContactBlock block={block} {...common} />
    case "social":
      return shop.footerBar?.social === "hidden" ? null : <SocialBlock block={block} {...common} />
    case "payments":
      return <PaymentsBlock block={block} {...common} />
    case "image":
      return <ImageBlock block={block} {...common} share={share} />
    case "trust":
      return <TrustBlock block={block} {...common} />
    // The stores' official badges are not in the storefront yet (adr/0070, open decision 3)
    case "app_badges":
    default:
      return null
  }
}

/**
 * One block in its box: the screens that show it (`data-device`) and, in
 * the theme editor's live preview, its field mark (`blocks.<at>`, its
 * place in the design). A block with nothing to draw takes no box.
 */
export function FooterBlock(props: Props) {
  const content = body(props)
  if (content === null) {
    return null
  }
  const { block, editor, join } = props
  return (
    <div
      className="gf-fblock"
      data-block={block.type}
      {...(block.device === "all" ? {} : { "data-device": block.device })}
      {...(join ? { "data-fold-join": join } : {})}
      {...fieldMark(editor, `blocks.${String(block.at)}`)}
    >
      {content}
    </div>
  )
}
