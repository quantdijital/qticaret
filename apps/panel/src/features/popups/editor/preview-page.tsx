import { cn } from "@qticaret/admin-ui/lib/utils"

/** Which part of the page is shown: a phone's whole screen, the page around a window, a corner. */
export type StandInView = "phone" | "window" | "corner"

/**
 * A storefront page's stand-in at its own size, behind the pop-up, in
 * plain grey: a header, a banner and products; for a corner card only the
 * products near the foot of the page. It fills the crop however tall the
 * pop-up makes it.
 */
export function PageStandIn({ view }: { view: StandInView }) {
  const phone = view === "phone"
  return (
    <div aria-hidden="true" className="absolute inset-0 overflow-hidden">
      {view === "corner" ? null : (
        <div
          className={cn(
            "flex items-center justify-between border-b bg-background",
            phone ? "h-14 px-4" : "h-16 px-8"
          )}
        >
          <span className="h-5 w-28 rounded-sm bg-muted" />
          {phone ? null : (
            <span className="flex gap-5">
              <span className="h-3 w-16 rounded-sm bg-muted" />
              <span className="h-3 w-16 rounded-sm bg-muted" />
              <span className="h-3 w-16 rounded-sm bg-muted" />
            </span>
          )}
          <span className="size-6 rounded-sm bg-muted" />
        </div>
      )}
      <div className={cn("flex flex-col", phone ? "gap-4 p-4" : "gap-6 p-8")}>
        {view === "corner" ? null : (
          <span className={cn("w-full rounded-md bg-muted", phone ? "h-56" : "h-64")} />
        )}
        <span className={cn("rounded-sm bg-muted", phone ? "h-5 w-1/2" : "h-6 w-1/3")} />
        <span className={cn("grid", phone ? "grid-cols-2 gap-4" : "grid-cols-3 gap-6")}>
          {Array.from({ length: phone ? 6 : 9 }, (_, index) => (
            <span key={index} className="aspect-[3/4] rounded-md bg-muted" />
          ))}
        </span>
      </div>
    </div>
  )
}
