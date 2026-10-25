import { ImageOff } from "lucide-react"
import { cn } from "@/lib/utils"

/** A product's picture in lists; a quiet placeholder when it has none. */
export function ProductThumb({
  src,
  className,
}: {
  src: string | null | undefined
  className?: string
}) {
  return src ? (
    <img
      src={src}
      alt=""
      loading="lazy"
      className={cn("size-10 shrink-0 rounded-md border object-cover", className)}
    />
  ) : (
    <span
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-md border bg-muted text-muted-foreground",
        className
      )}
    >
      <ImageOff className="size-4" aria-hidden="true" />
    </span>
  )
}
