import { cn } from "@qticaret/admin-ui/lib/utils"

/**
 * A storefront page's stand-in at the screen's own size, behind the
 * pop-up: a header, a banner and a row of products in plain grey. It
 * fills the screen however tall the pop-up makes it.
 */
export function PageStandIn({ phone }: { phone: boolean }) {
  return (
    <div aria-hidden="true" className="absolute inset-0 overflow-hidden">
      <div
        className={cn(
          "flex items-center justify-between border-b bg-background",
          phone ? "h-14 px-4" : "h-16 px-10"
        )}
      >
        <span className="h-5 w-32 rounded-sm bg-muted" />
        {phone ? null : (
          <span className="flex gap-6">
            <span className="h-3 w-20 rounded-sm bg-muted" />
            <span className="h-3 w-20 rounded-sm bg-muted" />
            <span className="h-3 w-20 rounded-sm bg-muted" />
          </span>
        )}
        <span className="size-6 rounded-sm bg-muted" />
      </div>
      <div className={cn("flex flex-col", phone ? "gap-4 p-4" : "gap-8 px-10 py-8")}>
        <span className={cn("w-full rounded-md bg-muted", phone ? "h-56" : "h-80")} />
        <span className={cn("rounded-sm bg-muted", phone ? "h-5 w-1/2" : "h-6 w-1/4")} />
        <span className={cn("grid", phone ? "grid-cols-2 gap-4" : "grid-cols-4 gap-6")}>
          {Array.from({ length: phone ? 6 : 8 }, (_, index) => (
            <span key={index} className="aspect-[3/4] rounded-md bg-muted" />
          ))}
        </span>
      </div>
    </div>
  )
}
