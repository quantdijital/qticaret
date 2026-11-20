import { FolderTree } from "lucide-react"

/**
 * A category's picture in a list row, in the storefront tile's 4:5; a
 * folder when it has none (the storefront then shows its newest product's
 * photo, which the category's own page names).
 */
export function CategoryThumb({ url }: { url: string | null }) {
  return (
    <span className="flex h-10 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
      {url ? (
        <img src={url} alt="" loading="lazy" className="size-full object-cover" />
      ) : (
        <FolderTree className="size-4 text-muted-foreground" aria-hidden="true" />
      )}
    </span>
  )
}
