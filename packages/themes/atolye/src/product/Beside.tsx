import type { ReactNode } from "react"
import { cn } from "@qticaret/ui/lib/utils"

/**
 * The product's text beside the shipping card: from 1024 px eight columns
 * and four, the card sticky while the longer side scrolls; on a phone the
 * card comes after. Without a card, the text alone.
 */
export function Beside({ aside, children }: { aside?: ReactNode; children: ReactNode }) {
  return (
    <div className="grid gap-8 lg:grid-cols-12 lg:gap-(--gap-columns)">
      <div
        className={cn(
          "flex min-w-0 flex-col gap-6 lg:gap-8",
          aside ? "lg:col-span-8" : "lg:col-span-12"
        )}
      >
        {children}
      </div>
      {aside && (
        <div className="min-w-0 lg:sticky lg:top-(--gf-stick-top) lg:col-span-4 lg:self-start">
          {aside}
        </div>
      )}
    </div>
  )
}
