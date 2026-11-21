import { Copy, X } from "lucide-react"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { SectionCard } from "@qticaret/admin-ui/patterns/section-card"
import { Button } from "@qticaret/admin-ui/ui/button"
import type { AiPostLink } from "@/features/ai/post-draft"

/**
 * The internal links a post draft suggested (adr/0074 §5 madde 5), kept
 * beside the editor after the draft went in: the body carries none, a
 * person adds each where it fits. "Bağlantıyı kopyala" copies the page's
 * path; the editor's link button takes it on the words chosen. Closing
 * forgets the list; nothing here is saved.
 */
export function PostLinkSuggestions({
  links,
  onClose,
}: {
  links: readonly AiPostLink[]
  onClose: () => void
}) {
  const { t } = useTranslation()
  const copy = (link: AiPostLink) => {
    navigator.clipboard.writeText(link.path).then(
      () => {
        toast.success(t("content.postDraft.copied", { path: link.path }))
      },
      () => {
        toast.error(t("content.postDraft.copyFailed", { path: link.path }))
      }
    )
  }
  return (
    <SectionCard
      title={t("content.postDraft.linksTitle")}
      description={t("content.postDraft.linksHint")}
      action={
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={t("content.postDraft.linksClose")}
          title={t("content.postDraft.linksClose")}
          onClick={onClose}
        >
          <X />
        </Button>
      }
    >
      <ul className="flex flex-col divide-y" data-slot="ai-post-links">
        {links.map((link) => (
          <li key={link.code} className="flex items-start gap-3 py-2 first:pt-0 last:pb-0">
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <p className="text-sm">
                <span className="text-xs text-muted-foreground">
                  {t(`content.postDraft.kinds.${link.kind}`)}
                </span>{" "}
                <span className="font-medium">{link.name}</span>
              </p>
              <p className="text-xs text-muted-foreground">{link.why}</p>
              <p className="truncate font-mono text-xs text-muted-foreground">{link.path}</p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label={t("content.postDraft.copyLabel", { name: link.name })}
              onClick={() => {
                copy(link)
              }}
            >
              <Copy />
              {t("content.postDraft.copy")}
            </Button>
          </li>
        ))}
      </ul>
    </SectionCard>
  )
}
