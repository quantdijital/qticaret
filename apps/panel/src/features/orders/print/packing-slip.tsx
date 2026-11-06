import { useTranslation } from "react-i18next"
import type { PackingItem, PackingOrder, PackingSlips } from "@/features/orders/api/packing"
import { formatDate, formatMoney } from "@/lib/format"

const P = "orders.print"

/** Who the papers come from: the logo, the shop's name and how it is reached. */
export function PrintHead({
  shop,
  title,
  sub,
}: {
  shop: PackingSlips["shop"]
  title: string
  sub?: string
}) {
  return (
    <header className="print-head">
      <div className="print-shop">
        {shop.logo_url ? <img src={shop.logo_url} alt={shop.name ?? ""} /> : null}
        <strong>{shop.company_title ?? shop.name}</strong>
        {shop.address ? <div>{shop.address}</div> : null}
        <div>{[shop.phone, shop.email].filter(Boolean).join(" · ")}</div>
      </div>
      <div className="print-title">
        <h1>{title}</h1>
        {sub ? <div>{sub}</div> : null}
      </div>
    </header>
  )
}

/** A line's add-on picks in full, as they are to be made (adr/0052 §9), and a gift's note. */
export function LineExtras({
  item,
}: {
  item: Pick<PackingItem, "addons" | "gift" | "non_withdrawable">
}) {
  const { t } = useTranslation()
  return (
    <>
      {item.addons.length > 0 ? (
        <ul className="print-addons">
          {item.addons.map((addon, index) => (
            <li key={`${addon.label}-${String(index)}`}>
              {addon.label}: <span className="value">{addon.value || "—"}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {item.non_withdrawable ? <div className="print-note">{t(`${P}.personalised`)}</div> : null}
      {item.gift ? (
        <div className="print-note">
          {t(`${P}.giftFor`, { name: item.gift.recipient })}
          {item.gift.message ? ` · “${item.gift.message}”` : ""}
          {item.gift.sender ? ` · ${t(`${P}.giftFrom`, { name: item.gift.sender })}` : ""}
        </div>
      ) : null}
    </>
  )
}

/**
 * One order's packing slip (an irsaliye-like paper for the box): who it
 * goes to, how it was paid and goes, each line with its SKU, variant,
 * quantity and add-on texts; prices only when the shop prints them; the
 * team's notes only when asked for this print (they are never the shopper's).
 */
export function PackingSlip({
  order,
  shop,
  prices,
  notes,
}: {
  order: PackingOrder
  shop: PackingSlips["shop"]
  prices: boolean
  notes: boolean
}) {
  const { t } = useTranslation()
  const address = order.shipping_address
  const money = (amount: string) => formatMoney(amount, order.currency_code)
  return (
    <section className="print-sheet" aria-label={t(`${P}.slipOf`, { number: order.display_id })}>
      <PrintHead
        shop={shop}
        title={t(`${P}.slipTitle`)}
        sub={`#${String(order.display_id)} · ${formatDate(order.created_at)}`}
      />
      <div className="print-columns">
        <div className="print-box">
          <h2>{t(`${P}.shipTo`)}</h2>
          {address ? (
            <>
              <p>
                <strong>{address.name ?? "—"}</strong>
              </p>
              {address.company ? <p>{address.company}</p> : null}
              {[address.address_1, address.address_2].filter(Boolean).map((line) => (
                <p key={line}>{line}</p>
              ))}
              <p>
                {[address.postal_code, address.district, address.city].filter(Boolean).join(" ")}
              </p>
              {address.phone ? <p>{address.phone}</p> : null}
            </>
          ) : (
            <p>—</p>
          )}
        </div>
        <div className="print-box">
          <h2>{t(`${P}.orderFacts`)}</h2>
          <p>
            {t(`${P}.payment`)}: {t(`orders.filters.methods.${order.payment_method}`)}
          </p>
          <p>
            {t(`${P}.delivery`)}: {order.delivery?.name ?? "—"}
          </p>
          {order.tracking_number ? (
            <p>
              {t(`${P}.tracking`)}: {order.tracking_number}
            </p>
          ) : null}
          {order.email ? <p className="print-muted">{order.email}</p> : null}
        </div>
      </div>
      <table className="print-table">
        <thead>
          <tr>
            <th className="check" aria-label={t(`${P}.packed`)} />
            <th>{t(`${P}.product`)}</th>
            <th>{t(`${P}.sku`)}</th>
            <th className="num">{t(`${P}.quantity`)}</th>
            {prices ? <th className="num">{t(`${P}.unitPrice`)}</th> : null}
            {prices ? <th className="num">{t(`${P}.lineTotal`)}</th> : null}
          </tr>
        </thead>
        <tbody>
          {order.items.map((item) => (
            <tr key={item.id}>
              <td className="check">
                <span className="print-checkbox" />
              </td>
              <td>
                <strong>{item.title}</strong>
                {item.variant ? <div className="print-muted">{item.variant}</div> : null}
                {!item.ships ? <div className="print-note">{t(`${P}.notShipped`)}</div> : null}
                <LineExtras item={item} />
              </td>
              <td>{item.sku ?? "—"}</td>
              <td className="num">{item.quantity}</td>
              {prices ? (
                <td className="num">{item.unit_price ? money(item.unit_price) : "—"}</td>
              ) : null}
              {prices ? <td className="num">{item.total ? money(item.total) : "—"}</td> : null}
            </tr>
          ))}
        </tbody>
      </table>
      {prices && order.totals ? (
        <div className="print-totals">
          <div>
            <span>{t(`${P}.itemsTotal`)}</span>
            <span>{money(order.totals.items)}</span>
          </div>
          {Number(order.totals.discount) > 0 ? (
            <div>
              <span>{t(`${P}.discount`)}</span>
              <span>−{money(order.totals.discount)}</span>
            </div>
          ) : null}
          <div>
            <span>{t(`${P}.shipping`)}</span>
            <span>{money(order.totals.shipping)}</span>
          </div>
          <div className="grand">
            <span>{t(`${P}.total`)}</span>
            <span>{money(order.totals.total)}</span>
          </div>
        </div>
      ) : null}
      {notes && order.notes.length > 0 ? (
        <div className="print-section">
          <h2>{t(`${P}.notes`)}</h2>
          {order.notes.map((note, index) => (
            <p key={index}>{note}</p>
          ))}
        </div>
      ) : null}
    </section>
  )
}
