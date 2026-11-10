/** The letters an avatar shows: the first and last word's first letter, Turkish upper case. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const letters = parts.length > 1 ? [parts[0], parts[parts.length - 1]] : parts
  return letters.map((part) => (part ?? "").slice(0, 1).toLocaleUpperCase("tr")).join("")
}
