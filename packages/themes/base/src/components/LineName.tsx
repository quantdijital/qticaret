/**
 * A bought line's name (cart, drawer, checkout, order): a link to its
 * product's page when the line has one, else the words alone.
 */
export function LineName({
  path,
  title,
  onFollow,
}: {
  path?: string | null | undefined
  title: string
  /** Run when the link is followed: the drawer shuts behind it. */
  onFollow?: (() => void) | undefined
}) {
  if (!path) {
    return title
  }
  return (
    <a href={path} onClick={onFollow} className="underline-offset-4 hover:underline">
      {title}
    </a>
  )
}
