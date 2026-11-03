/**
 * A statement put together in parts, each value bound (adr/0056). A part
 * names its values with markers as it is made; `finish` turns them into
 * the driver's `?` placeholders in the order they stand in the text, so
 * parts can be made in any order. The text holds only this module's own
 * SQL: nothing a shopper or a product holds is written into it.
 */

const MARK = "\u0000"
const MARKED = new RegExp(`${MARK}(\\d+)${MARK}`, "g")

export class Statement {
  private readonly values: unknown[] = []

  /** A bound value. */
  param(value: unknown): string {
    this.values.push(value)
    return `${MARK}${String(this.values.length - 1)}${MARK}`
  }

  /** A bound list, as `text[]`. */
  textArray(values: readonly string[]): string {
    return `ARRAY(SELECT jsonb_array_elements_text(${this.param(JSON.stringify(values))}::jsonb))`
  }

  finish(text: string): { sql: string; params: unknown[] } {
    const params: unknown[] = []
    const sql = text.replace(MARKED, (_, index: string) => {
      params.push(this.values[Number(index)])
      return "?"
    })
    return { sql, params }
  }
}
