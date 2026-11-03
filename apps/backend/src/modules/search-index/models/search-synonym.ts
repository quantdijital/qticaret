import { model } from "@medusajs/framework/utils"

/**
 * A group of words a shopper may use for one another (adr/0056): `tişört`,
 * `t shirt`, `tshirt`. Both ways: searching any term also finds the
 * others. Terms are kept as the shop typed them (Turkish lower case);
 * search compares them without marks. A term is one to three words.
 */
export const SearchSynonym = model.define("search_synonym", {
  id: model.id({ prefix: "ssyn" }).primaryKey(),
  terms: model.array(),
})
