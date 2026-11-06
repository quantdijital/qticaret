import type { Resolution } from "@qticaret/types"
import { BlogArchiveScreen, BlogAuthorScreen } from "./blog"
import { ContentScreen } from "./content"
import { ListingScreen } from "./listing"
import { ProductScreen } from "./product"

type Entity = Extract<Resolution, { type: "entity" }>

/**
 * The page of a record resolve found (adr/0046 §3), by its type: the
 * catch-all route's and the design preview's (adr/0049) one switch.
 */
export function EntityScreen({ page, url }: { page: Entity; url: URL }) {
  switch (page.entity_type) {
    case "product":
      return <ProductScreen page={page} url={url} />
    case "page":
    case "post":
      return <ContentScreen page={page} />
    case "post_category":
    case "post_tag":
      return <BlogArchiveScreen page={page} url={url} />
    case "post_author":
      return <BlogAuthorScreen page={page} url={url} />
    case "product_category":
    case "product_collection":
    case "brand":
    case "landing":
    case "sale":
      return <ListingScreen page={page} url={url} />
  }
}
