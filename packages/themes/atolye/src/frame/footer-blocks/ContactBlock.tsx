import { MapPin } from "lucide-react"
import { ReachList } from "../FooterParts"
import { BlockTitle, blockHeadingId } from "./shared"
import type { BlockProps } from "./shared"

/**
 * How the shop is reached (adr/0048: its store details, never typed in
 * here): the address, the phone, WhatsApp and e-mail as the brand
 * columns' strip draws them (a round sign each), then the hours, days
 * with the same hours together. Only the ones the block keeps and the
 * shop filled in.
 */
export function ContactBlock({ block, shop, t, editor }: BlockProps<"contact">) {
  const labelled = block.title ? { "aria-labelledby": blockHeadingId(block.at) } : {}
  return (
    <section {...labelled} className="flex flex-col gap-4">
      {block.title && (
        <BlockTitle at={block.at} editor={editor}>
          {block.title}
        </BlockTitle>
      )}
      {block.address && (
        <p className="flex items-start gap-3 text-sm text-text-2">
          <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" strokeWidth={2} />
          <span className="max-w-[36ch]">{block.address}</span>
        </p>
      )}
      <ReachList shop={shop} t={t} contact={block} />
      {block.hours.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold text-text">{t("contact.info_hours")}</p>
          <dl className="flex max-w-[22rem] flex-col gap-1 text-xs">
            {block.hours.map((line) => (
              <div key={line.days} className="flex justify-between gap-4">
                <dt className="text-text-2">{line.days}</dt>
                <dd className="tabular font-semibold text-text">{line.hours}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </section>
  )
}
