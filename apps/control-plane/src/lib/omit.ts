/** A copy of `row` without `keys` (a relation the ORM adds, a column a write must not carry). */
export function omit<T extends object, K extends string>(row: T, ...keys: K[]): Omit<T, K> {
  return Object.fromEntries(
    Object.entries(row).filter(([key]) => !(keys as string[]).includes(key))
  ) as Omit<T, K>
}
