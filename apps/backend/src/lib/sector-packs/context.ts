import type { MedusaContainer } from "@medusajs/framework/types"
import type { OfferedItem } from "../../modules/sector-packs/service"
import type { CheckedPack } from "./check"

/** What each kind of item is applied with (adr/0061 C12). */
export interface ApplyContext {
  container: MedusaContainer
  pack: CheckedPack
  /** The items of the pack offered here before, by key (this run's own added as they go). */
  offered: ReadonlyMap<string, OfferedItem>
  /** An item offered now, recorded at once: a failure later still finds it done. */
  record: (item: OfferedItem) => Promise<void>
}
