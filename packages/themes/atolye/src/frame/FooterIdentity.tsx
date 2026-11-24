import { ResponsiveImage } from "@qticaret/ui"
import type { ShopView, Translate } from "@qticaret/ui"

/** The shop has a line of its identity to say: its title, its lines or the ETBİS mark. */
export const hasIdentity = (shop: ShopView): boolean =>
  shop.identityLines.length > 0 ||
  (shop.etbisQr ?? null) !== null ||
  (shop.companyTitle ?? shop.name) !== shop.name

/**
 * The identity lines the law asks for (6563, ETBİS: the registered title
 * when it differs from the shop's name, MERSİS, tax, KEP…) beside the
 * ETBİS code; nothing when the shop has none of them.
 */
export function FooterIdentity({ shop, t }: { shop: ShopView; t: Translate }) {
  const title = shop.companyTitle ?? shop.name
  const qr = shop.etbisQr ?? null
  if (!hasIdentity(shop)) {
    return null
  }
  return (
    <div className="flex items-start gap-4">
      {qr && (
        <span className="block size-14 shrink-0 rounded-inner border border-rule bg-chip p-1">
          <ResponsiveImage
            image={{ ...qr, alt: t("footer.etbis_qr_alt") }}
            sizes="56px"
            className="h-full w-full object-contain"
          />
        </span>
      )}
      <ul className="flex flex-col gap-0.5 text-xs text-text-3">
        {title !== shop.name && <li className="font-semibold text-text-2">{title}</li>}
        {shop.identityLines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  )
}
