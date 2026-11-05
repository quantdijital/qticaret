import type { SpecGroupView } from "@qticaret/ui"

/** A number and its unit stay on one line ("22 cm", "58-59 HRC"): the space after a digit never breaks. */
const keptTogether = (value: string) => value.trim().replace(/(\d)\s+(?=\S)/g, "$1 ")

/** A label longer than this would wrap in two fifths of a phone: there it stands above its value. */
const LONG_LABEL = 18

/**
 * The specs as one simple table (owner 2026-11-05: "ürün özellikleri
 * tasarımını yine beğenmedim; tablo gibi alt alta olabilir"): the
 * template's groups one under another, never side by side, each opened by
 * a small semibold row; then label | value rows on hairlines, the label
 * muted in two fifths of the width, the value in regular ink; no tile
 * around it. On a phone a long label stands above its value, a short one
 * beside it (`tabs.css`). Empty values and groups with none are left out;
 * without groups, one untitled run of rows.
 */
export function Specs({ groups }: { groups: SpecGroupView[] }) {
  const shown = groups
    .map((group) => ({ ...group, rows: group.rows.filter((spec) => spec.value.trim() !== "") }))
    .filter((group) => group.rows.length > 0)
  return (
    <table className="gf-specs">
      <colgroup>
        <col className="w-2/5" />
        <col />
      </colgroup>
      {shown.map((group, index) => (
        <tbody key={group.title ?? `grup-${String(index)}`}>
          {group.title !== null && (
            <tr>
              <th scope="rowgroup" colSpan={2}>
                {group.title}
              </th>
            </tr>
          )}
          {group.rows.map((spec) => (
            <tr key={spec.label} data-long={spec.label.length > LONG_LABEL ? "" : undefined}>
              <th scope="row">{spec.label}</th>
              <td className="tabular">{keptTogether(spec.value)}</td>
            </tr>
          ))}
        </tbody>
      ))}
    </table>
  )
}
