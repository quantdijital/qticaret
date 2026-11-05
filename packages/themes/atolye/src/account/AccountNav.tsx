import { ChevronRight, Heart, House, LogOut, MapPin, Package, UserRound } from "lucide-react"
import type { AccountActions, AccountPageView, AccountSection, Translate } from "@qticaret/ui"
import { cn } from "@qticaret/ui/lib/utils"

/** Each section's icon; a link the storefront did not name has none. */
const ICONS: Record<AccountSection, typeof House> = {
  overview: House,
  orders: Package,
  favorites: Heart,
  addresses: MapPin,
  profile: UserRound,
}

/** What each section holds, one line under its name on the overview. */
const HINTS: Partial<Record<AccountSection, string>> = {
  orders: "account.hub_orders",
  favorites: "account.hub_favorites",
  addresses: "account.hub_addresses",
  profile: "account.hub_profile",
}

type Nav = AccountPageView["nav"][number]

function NavIcon({ link, className }: { link: Nav; className?: string }) {
  const Icon = link.section ? ICONS[link.section] : null
  return Icon ? (
    <Icon className={cn("size-5 shrink-0", className)} aria-hidden="true" strokeWidth={1.75} />
  ) : null
}

/** Signing out: a plain form, a row like the links above it. */
function SignOut({
  actions,
  t,
  className,
  circle = false,
}: {
  actions: AccountActions
  t: Translate
  className: string
  /** The overview's rows: the icon in a circle like theirs. */
  circle?: boolean
}) {
  const icon = <LogOut className="size-5 shrink-0" aria-hidden="true" strokeWidth={1.75} />
  return (
    <form action={actions.logout}>
      <button type="submit" className={className}>
        {circle ? (
          <span className="flex size-11 shrink-0 items-center justify-center rounded-pill bg-field">
            {icon}
          </span>
        ) : (
          icon
        )}
        {t("account.logout")}
      </button>
    </form>
  )
}

/**
 * The account's menu beside a section from 1024 px: who is signed in, the
 * sections as 48 px pill rows (the one shown filled in ink), signing out
 * last; it stays in sight under the header while the section scrolls.
 */
export function SideNav({
  view,
  t,
  actions,
}: {
  view: AccountPageView
  t: Translate
  actions: AccountActions
}) {
  const row =
    "flex min-h-12 w-full items-center gap-3 rounded-pill px-4 text-md font-semibold no-underline transition-colors duration-(--dur-micro)"
  return (
    <nav
      aria-label={t("account.menu")}
      className="hidden flex-col gap-2 self-start rounded-tile bg-paper-2 p-3 lg:sticky lg:top-40 lg:flex"
    >
      <p className="flex flex-col px-4 pt-2 pb-3">
        <span className="text-md font-extrabold">{view.name}</span>
        <span className="truncate text-sm text-text-2" title={view.email}>
          {view.email}
        </span>
      </p>
      <ul className="flex flex-col gap-1">
        {view.nav.map((link) => (
          <li key={link.path}>
            <a
              href={link.path}
              aria-current={link.current ? "page" : undefined}
              className={cn(row, link.current ? "bg-text text-paper" : "hover:bg-paper-3")}
            >
              <NavIcon link={link} />
              {link.label}
            </a>
          </li>
        ))}
      </ul>
      <div className="border-t border-rule pt-2">
        <SignOut
          actions={actions}
          t={t}
          className={cn(row, "cursor-pointer text-text-2 hover:bg-paper-3 hover:text-text")}
        />
      </div>
    </nav>
  )
}

/**
 * The overview's way into each section (the account's menu on a phone,
 * where no side menu stands): a tinted well of 64 px rows, each its icon
 * in a field-coloured circle, its name and one line of what it holds;
 * signing out is the last row.
 */
export function Hub({
  view,
  t,
  actions,
  className,
}: {
  view: AccountPageView
  t: Translate
  actions: AccountActions
  className?: string
}) {
  const row =
    "flex min-h-16 w-full items-center gap-4 rounded-media px-3 py-3 text-left no-underline transition-colors duration-(--dur-micro) hover:bg-paper-3"
  const links = view.nav.filter((link) => link.section !== "overview" && !link.current)
  return (
    <nav
      aria-label={t("account.menu")}
      className={cn("flex flex-col rounded-tile bg-paper-2 p-2", className)}
    >
      <ul className="flex flex-col">
        {links.map((link) => {
          const hint = link.section ? HINTS[link.section] : undefined
          return (
            <li key={link.path}>
              <a href={link.path} className={row}>
                <span className="flex size-11 shrink-0 items-center justify-center rounded-pill bg-field">
                  <NavIcon link={link} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-md font-extrabold">{link.label}</span>
                  {hint && <span className="text-sm text-text-2">{t(hint)}</span>}
                </span>
                <ChevronRight
                  className="size-5 shrink-0 text-text-3"
                  aria-hidden="true"
                  strokeWidth={1.75}
                />
              </a>
            </li>
          )
        })}
      </ul>
      <SignOut
        actions={actions}
        t={t}
        circle
        className={cn(row, "cursor-pointer text-md font-semibold text-text-2 hover:text-text")}
      />
    </nav>
  )
}
