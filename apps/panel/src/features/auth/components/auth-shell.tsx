import type { ReactNode } from "react"
import { cn } from "@qticaret/admin-ui/lib/utils"
import { AuthIntro } from "./auth-intro"
import { useDocumentTitle } from "@qticaret/admin-ui/hooks/use-document-title"

/**
 * The pages before the panel: sign-in, a forgotten password, an
 * invitation, 2FA setup (the owner, 2026-11-04). From `lg` up two equal
 * columns, the product's introduction on the left and the page's own box
 * on the right; below it the introduction is a short strip above the box.
 * The box comes first in the document, so the keyboard and a screen
 * reader reach the form before the introduction, whatever the layout.
 */
export function AuthShell({
  children,
  after,
  wide = false,
}: {
  children: ReactNode
  /** A line under the box, outside it (a hint for someone without an account). */
  after?: ReactNode
  /** The 2FA setup's QR code and key need more room than a form. */
  wide?: boolean
}) {
  return (
    <div className="grid min-h-svh grid-rows-[auto_1fr] lg:grid-cols-2 lg:grid-rows-1">
      <main className="flex items-start justify-center px-6 pt-10 pb-6 sm:items-center sm:px-10 sm:py-10 lg:px-12">
        <div className={cn("flex w-full flex-col gap-6", wide ? "max-w-lg" : "max-w-sm")}>
          <div className="sm:rounded-xl sm:bg-card sm:p-8">{children}</div>
          {after}
        </div>
      </main>
      <AuthIntro className="order-first" />
    </div>
  )
}

/** The box's title and its one sentence. */
export function AuthHeading({ title, subtitle }: { title: string; subtitle: ReactNode }) {
  useDocumentTitle(title)
  return (
    <div className="flex flex-col gap-1.5">
      <h1 className="text-[22px] leading-tight font-semibold tracking-tight">{title}</h1>
      <p className="text-sm text-muted-foreground">{subtitle}</p>
    </div>
  )
}
