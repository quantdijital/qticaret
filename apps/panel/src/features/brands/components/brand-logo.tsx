import { cn } from "@qticaret/admin-ui/lib/utils"

/** A brand's logo on a neutral tile, or its initial when it has none. */
export function BrandLogo({
  url,
  name,
  className,
}: {
  url: string | null
  name: string
  className?: string
}) {
  return (
    <span
      className={cn(
        "flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted",
        className
      )}
    >
      {url ? (
        <img src={url} alt="" className="size-full object-contain p-1" />
      ) : (
        <span className="text-sm font-semibold text-muted-foreground" aria-hidden="true">
          {name.trim().charAt(0).toLocaleUpperCase("tr")}
        </span>
      )}
    </span>
  )
}
