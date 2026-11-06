import { useTranslation } from "react-i18next"
import type { PackingSlips } from "@/features/orders/api/packing"
import { LineExtras, PrintHead } from "@/features/orders/print/packing-slip"
import { pickList } from "@/features/orders/print/pick-list"
import { formatDate } from "@/lib/format"

const P = "orders.print"

/**
 * The pick list of the picked orders (one paper for the shelves): each
 * product once with its units across them, then every order's line under
 * it with its add-on texts; the team's notes for each order at the end.
 */
export function PickListSheet({ slips }: { slips: PackingSlips }) {
  const { t } = useTranslation()
  const rows = pickList(slips.orders)
  const noted = slips.orders.filter((order) => order.notes.length > 0)
  return (
    <section className="print-sheet" aria-label={t(`${P}.pickTitle`)}>
      <PrintHead
        shop={slips.shop}
        title={t(`${P}.pickTitle`)}
        sub={`${t(`${P}.ordersCount`, { count: slips.orders.length })} · ${formatDate(new Date())}`}
      />
      <table className="print-table" style={{ marginTop: 14 }}>
        <thead>
          <tr>
            <th className="check" aria-label={t(`${P}.picked`)} />
            <th>{t(`${P}.product`)}</th>
            <th>{t(`${P}.sku`)}</th>
            <th className="num">{t(`${P}.quantity`)}</th>
            <th>{t(`${P}.perOrder`)}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <td className="check">
                <span className="print-checkbox" />
              </td>
              <td>
                <strong>{row.title}</strong>
                {row.variant ? <div className="print-muted">{row.variant}</div> : null}
              </td>
              <td>{row.sku ?? "—"}</td>
              <td className="num">
                <strong>{row.quantity}</strong>
              </td>
              <td>
                {row.entries.map((entry, index) => (
                  <div key={`${entry.orderId}-${String(index)}`}>
                    #{entry.displayId} × {entry.quantity}
                    <LineExtras
                      item={{ addons: entry.addons, gift: null, non_withdrawable: false }}
                    />
                  </div>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 ? <p className="print-message">{t(`${P}.nothingToPick`)}</p> : null}
      {noted.length > 0 ? (
        <div className="print-section">
          <h2>{t(`${P}.notes`)}</h2>
          {noted.map((order) => (
            <p key={order.id}>
              <strong>#{order.display_id}</strong>: {order.notes.join(" · ")}
            </p>
          ))}
        </div>
      ) : null}
    </section>
  )
}
