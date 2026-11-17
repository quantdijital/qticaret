import { MarkList } from "../FooterParts"
import { BlockTitle, blockHeadingId } from "./shared"
import type { BlockProps } from "./shared"

/**
 * The ways to pay by their own marks (the footer's `payment_badges`, else
 * the providers'), and the carriers' when the block asks: the bottom
 * line's marks, on their cards or straight on the ground (`badge_style`).
 */
export function PaymentsBlock({ block, t, editor }: BlockProps<"payments">) {
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
      <MarkList marks={block.payments} label={t("footer.payment_marks")} />
      <MarkList marks={block.carriers} label={t("footer.carrier_marks")} />
    </section>
  )
}
