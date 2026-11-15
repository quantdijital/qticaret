import { NavigationMenu } from "radix-ui"
import { ResponsiveImage } from "@qticaret/ui"
import type { NavCategoryView } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"

/** A category's panel: its children in short columns beside its picture tile. */
export function Panel({
  category,
  allIn,
  seeAll,
  narrow = false,
}: {
  category: NavCategoryView
  allIn: string
  seeAll: string
  /** A few children: one column beside a small picture, the panel as wide as they are. */
  narrow?: boolean
}) {
  return (
    <div
      className={
        narrow
          ? "grid w-max grid-cols-[18rem_auto] gap-(--space-lg)"
          : "grid grid-cols-[minmax(0,1fr)_minmax(0,18rem)] gap-(--space-xl) xl:grid-cols-[minmax(0,1fr)_minmax(0,21rem)]"
      }
    >
      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex items-baseline justify-between gap-6 border-b border-rule pb-4">
          <p className="text-title leading-tight font-extrabold tracking-(--tracking-display)">
            {category.label}
          </p>
          <NavigationMenu.Link asChild>
            {/* The name stands once, over the link (Tezgâh audit K-21); a screen reader hears it whole */}
            <a href={category.path} aria-label={allIn} className="gf-link shrink-0 text-sm">
              {seeAll || allIn}
            </a>
          </NavigationMenu.Link>
        </div>
        <ul className={narrow ? "flex flex-col" : "columns-3 gap-x-(--gap-columns) xl:columns-4"}>
          {category.children.map((child) => (
            <li key={child.path} className="break-inside-avoid">
              <NavigationMenu.Link asChild>
                <a
                  href={child.path}
                  className="-mx-3 flex min-h-10 items-center pointer-coarse:min-h-11 rounded-inner px-3 py-2 text-sm leading-snug text-text-2 no-underline hover:bg-paper-2 hover:text-text"
                >
                  {child.label}
                </a>
              </NavigationMenu.Link>
            </li>
          ))}
        </ul>
      </div>
      {category.image && (
        // The same page as the link above, by its picture: one stop for the keyboard
        <a
          href={category.path}
          tabIndex={-1}
          aria-hidden="true"
          className={cn(
            "relative block aspect-[4/3] self-start overflow-hidden rounded-media bg-paper-2 no-underline",
            narrow && "w-48"
          )}
        >
          <ResponsiveImage
            image={{ ...category.image, alt: "" }}
            sizes={narrow ? "192px" : "(min-width: 1280px) 336px, 288px"}
            className="absolute inset-0 h-full w-full object-cover"
          />
        </a>
      )}
    </div>
  )
}
