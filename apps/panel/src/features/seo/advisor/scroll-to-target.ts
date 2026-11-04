/** The page's own way to a field: scrolled to, smoothly, its top in sight. */
export const scrollToTarget = (target: string): void => {
  document.getElementById(target)?.scrollIntoView({ behavior: "smooth", block: "start" })
}
