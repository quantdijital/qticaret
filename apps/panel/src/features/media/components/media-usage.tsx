import { Link } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import type { MediaUse } from "@/features/media/api/media"

const U = "media.usage"

const LINK = "min-w-0 truncate text-primary-text hover:underline"

/** One place the image shows, opened where the panel has a page for it. */
function Place({ use }: { use: MediaUse }) {
  const { t } = useTranslation()
  const name = use.label ?? t(`${U}.unnamed`)
  const id = use.id ?? ""
  switch (use.kind) {
    case "product":
    case "product_description":
      return (
        <Link to="/products/$id" params={{ id }} className={LINK}>
          {name}
        </Link>
      )
    case "brand":
      return (
        <Link to="/brands/$id" params={{ id }} className={LINK}>
          {name}
        </Link>
      )
    case "content":
      return (
        <Link to="/content/$id" params={{ id }} className={LINK}>
          {name}
        </Link>
      )
    case "category":
      return (
        <Link to="/categories" search={{ selected: id }} className={LINK}>
          {name}
        </Link>
      )
    case "collection":
      return (
        <Link to="/collections/$id" params={{ id }} className={LINK}>
          {name}
        </Link>
      )
    case "landing":
      return (
        <Link to="/content/landings/$id" params={{ id }} className={LINK}>
          {name}
        </Link>
      )
    case "bulk_message":
      return (
        <Link to="/bulk-messages/$id" params={{ id }} className={LINK}>
          {name}
        </Link>
      )
    case "storefront":
      return (
        <Link to="/storefront/editor" className={LINK}>
          {t(`${U}.storefrontLink`)}
        </Link>
      )
    case "logo":
      return (
        <Link to="/settings/store" className={LINK}>
          {t(`${U}.logoLink`)}
        </Link>
      )
    case "favicon":
      return (
        <Link to="/settings/store" className={LINK}>
          {t(`${U}.faviconLink`)}
        </Link>
      )
    case "etbis_qr":
      return (
        <Link to="/settings/store" search={{ part: "legal" }} className={LINK}>
          {t(`${U}.etbisQrLink`)}
        </Link>
      )
    case "share_image":
      return (
        <Link to="/settings/seo" className={LINK}>
          {t(`${U}.shareImageLink`)}
        </Link>
      )
    case "seo":
      return <span>{t(`${U}.seoPage`, { page: t(`${U}.seoTypes.${use.label ?? "page"}`) })}</span>
    case "order":
      return <span>{t(`${U}.orderText`)}</span>
  }
}

/**
 * Where the shop shows the image (`GET /admin/media/:id`): what keeps it
 * from being deleted, each place under its kind and opened from here.
 */
export function MediaUsage({ usage }: { usage: MediaUse[] }) {
  const { t } = useTranslation()
  if (usage.length === 0) {
    return <p className="text-[13px] text-muted-foreground">{t(`${U}.none`)}</p>
  }
  return (
    <ul className="flex flex-col divide-y rounded-md border">
      {usage.map((use, index) => (
        <li
          key={`${use.kind}-${use.id ?? String(index)}`}
          className="flex min-h-10 items-center justify-between gap-3 px-3 py-2 text-[13px]"
        >
          <Place use={use} />
          <span className="shrink-0 text-xs text-muted-foreground">
            {t(`${U}.kinds.${use.kind}`)}
          </span>
        </li>
      ))}
    </ul>
  )
}
