import "server-only"
import type { StorePostsSection } from "@qticaret/types"
import { postsPanelStepOf } from "@qticaret/types/section-posts"
import { variantOf } from "@qticaret/types/section-variants"
import type { PostsSectionView, Translate } from "@qticaret/ui"
import { blogPosts } from "@/lib/store-api/blog"
import { layoutLink } from "./layout"
import { postCards } from "./posts"

/**
 * The shop's newest posts as a theme draws them, up to the section's count;
 * none, no section. The intro panel (adr/0077 Ek) brings its upper line,
 * intro and button only when the contract knows it; its button is the
 * shop's link (a broken one none), else the storefront's "every post".
 */
export async function postsView(
  section: StorePostsSection,
  t: Translate
): Promise<PostsSectionView | null> {
  const { entries } = await blogPosts(0, section.limit)
  if (entries.length === 0) {
    return null
  }
  const all = { label: t("home.all_posts"), path: "/blog" }
  const view: PostsSectionView = {
    id: section.id,
    type: "posts",
    title: section.title ?? t("home.posts"),
    posts: postCards(entries, t),
    more: all,
  }
  if (variantOf("posts", section.variant) !== "intro_panel") {
    return view
  }
  return {
    ...view,
    variant: "intro_panel",
    eyebrow: section.eyebrow ?? null,
    intro: section.intro ?? null,
    more: layoutLink(section.link ?? null, t) ?? all,
    ...(postsPanelStepOf("panel_tone", section.panel_tone) === "tint" ? { panelTone: "tint" } : {}),
    ...(postsPanelStepOf("ornament", section.ornament) === "leaves" ? { ornament: "leaves" } : {}),
    ...(postsPanelStepOf("cover_ratio", section.cover_ratio) === "wide"
      ? { coverRatio: "wide" }
      : {}),
  }
}
