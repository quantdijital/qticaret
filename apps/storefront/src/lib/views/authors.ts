import type { AuthorView, SocialLinkView, Translate } from "@qticaret/ui"
import type { StoreContentAuthorDetail, StoreContentAuthorLink } from "@qticaret/types"
import { imageView } from "./image"
import { paragraphsOf } from "./text"

/**
 * A blog author as a theme shows them (adr/0060): the post's closing box
 * and the head of the author's page. The words for the links are the
 * storefront's; the order is fixed, whatever the backend's.
 */

const LINK_ORDER: readonly StoreContentAuthorLink["kind"][] = [
  "website",
  "linkedin",
  "instagram",
  "x",
]

const isWebAddress = (url: string): boolean => {
  try {
    const { protocol } = new URL(url)
    return protocol === "https:" || protocol === "http:"
  } catch {
    return false
  }
}

/** The author's profiles in a fixed order, each labelled; anything that is no web address is left out. */
export function authorLinks(
  links: readonly StoreContentAuthorLink[],
  t: Translate
): SocialLinkView[] {
  return LINK_ORDER.flatMap((kind) => {
    const link = links.find((each) => each.kind === kind && isWebAddress(each.url))
    return link ? [{ label: t(`blog.author_link_${kind}`), href: link.url }] : []
  })
}

/** The author's photo with its size and versions; the name is its alt text. */
const photoOf = (author: StoreContentAuthorDetail) =>
  author.image_url
    ? imageView(
        {
          url: author.image_url,
          alt: author.name,
          width: author.image_width ?? null,
          height: author.image_height ?? null,
          derivatives: author.image_derivatives ?? null,
        },
        author.name
      )
    : null

/**
 * The author whole: name, page, title, bio as paragraphs, photo and links.
 * `bio: false` leaves the bio out (an author's later list pages, as an
 * archive's own words show on its first page only).
 */
export function authorView(
  author: StoreContentAuthorDetail,
  t: Translate,
  { bio = true }: { bio?: boolean } = {}
): AuthorView {
  return {
    name: author.name,
    path: author.path,
    jobTitle: author.job_title?.trim() ? author.job_title.trim() : null,
    bio: bio ? paragraphsOf(author.bio) : [],
    image: photoOf(author),
    links: authorLinks(author.links, t),
  }
}
