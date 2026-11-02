import type { MedusaContainer } from "@medusajs/framework/types"
import { MedusaError } from "@medusajs/framework/utils"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
} from "@medusajs/framework/workflows-sdk"
import { acquireLockStep, releaseLockStep } from "@medusajs/medusa/core-flows"
import { ValidationError } from "../../lib/errors"
import type { MenuInput, MenuLinkInput } from "../../lib/storefront/menus"
import { STOREFRONT_MENUS_MODULE } from "../../modules/storefront-menus"
import type StorefrontMenusModuleService from "../../modules/storefront-menus/service"
import { existingRecords, isRecordKind } from "./menu-links"

const MENUS_LOCK = { key: "storefront-menus", timeout: 10, ttl: 60 }

const menus = (container: Pick<MedusaContainer, "resolve">) =>
  container.resolve<StorefrontMenusModuleService>(STOREFRONT_MENUS_MODULE)

export interface SaveMenuInput extends MenuInput {
  /** The menu to change; none: a new one. */
  id?: string
}

const linksOf = (input: MenuInput): MenuLinkInput[] =>
  input.items.flatMap((each) => [each.link, ...each.children])

/** A link as stored: its target or its address, and its own wording. */
const stored = (link: MenuLinkInput) =>
  link.kind === "url"
    ? { kind: link.kind, target: null, url: link.url, label: link.label }
    : { kind: link.kind, target: link.target, url: null, label: link.label }

/**
 * The menu may be saved: it exists (when changed), its place is free (one
 * header menu, one row of top links) and every record it links exists.
 */
const checkMenuStep = createStep(
  "storefront-menu-check",
  async (input: SaveMenuInput, { container }) => {
    const service = menus(container)
    if (input.id) {
      const [current] = await service.listStorefrontMenus({ id: input.id }, { select: ["id"] })
      if (!current) {
        throw new MedusaError(MedusaError.Types.NOT_FOUND, "storefront_menus.unknown")
      }
    }
    if (input.location !== "footer") {
      const taken = await service.listStorefrontMenus(
        { location: input.location },
        { select: ["id"] }
      )
      if (taken.some((menu) => menu.id !== input.id)) {
        throw new ValidationError("storefront_menus.location_taken", { field: "location" })
      }
    }
    const links = linksOf(input).map(stored)
    const found = await existingRecords(container, links)
    const missing = links.some(
      (link) => isRecordKind(link.kind) && !found.has(`${link.kind}:${link.target ?? ""}`)
    )
    if (missing) {
      throw new ValidationError("storefront_menus.target_unknown", { field: "items" })
    }
    return new StepResponse(undefined)
  }
)

interface Snapshot {
  menu: { id: string; title: string; location: "main" | "top" | "footer"; rank: number }
  items: {
    id: string
    menu_id: string
    parent_id: string | null
    rank: number
    label: string | null
    kind: ReturnType<typeof stored>["kind"]
    target: string | null
    url: string | null
  }[]
}

async function snapshotOf(
  service: StorefrontMenusModuleService,
  id: string
): Promise<Snapshot | null> {
  const [menu] = await service.listStorefrontMenus(
    { id },
    { select: ["id", "title", "location", "rank"] }
  )
  if (!menu) {
    return null
  }
  const items = await service.listStorefrontMenuItems(
    { menu_id: id },
    { select: ["id", "menu_id", "parent_id", "rank", "label", "kind", "target", "url"] }
  )
  return { menu, items: items }
}

// Children after their parents: a restored child points at a restored parent
const parentsFirst = (items: Snapshot["items"]) =>
  [...items].sort((a, b) => Number(a.parent_id !== null) - Number(b.parent_id !== null))

async function restore(service: StorefrontMenusModuleService, snapshot: Snapshot) {
  await service.updateStorefrontMenus(snapshot.menu)
  if (snapshot.items.length > 0) {
    await service.createStorefrontMenuItems(parentsFirst(snapshot.items))
  }
}

/** Writes the menu and replaces its links; undone, the menu is as it was (or gone, if new). */
const saveMenuStep = createStep(
  "storefront-menu-save",
  async (input: SaveMenuInput, { container }) => {
    const service = menus(container)
    const previous = input.id ? await snapshotOf(service, input.id) : null
    const fields = { title: input.title, location: input.location, rank: input.rank }
    let menuId: string
    if (previous) {
      menuId = previous.menu.id
      await service.updateStorefrontMenus({ id: menuId, ...fields })
      await service.deleteStorefrontMenuItems(previous.items.map((item) => item.id))
    } else {
      menuId = (await service.createStorefrontMenus(fields)).id
    }
    const parents = await service.createStorefrontMenuItems(
      input.items.map((each, rank) => ({ menu_id: menuId, rank, ...stored(each.link) }))
    )
    const children = input.items.flatMap((each, index) =>
      each.children.map((child, rank) => ({
        menu_id: menuId,
        parent_id: parents[index]?.id ?? null,
        rank,
        ...stored(child),
      }))
    )
    if (children.length > 0) {
      await service.createStorefrontMenuItems(children)
    }
    return new StepResponse({ id: menuId }, { menuId, previous })
  },
  async (undo, { container }) => {
    if (!undo) {
      return
    }
    const service = menus(container)
    const current = await service.listStorefrontMenuItems(
      { menu_id: undo.menuId },
      { select: ["id"] }
    )
    await service.deleteStorefrontMenuItems(current.map((item) => item.id))
    if (undo.previous) {
      await restore(service, undo.previous)
    } else {
      await service.deleteStorefrontMenus(undo.menuId)
    }
  }
)

/** Creates or changes a storefront menu (adr/0049): checked, written whole, undone on failure. */
export const saveStorefrontMenuWorkflow = createWorkflow(
  "storefront-menu-save",
  (input: SaveMenuInput) => {
    acquireLockStep(MENUS_LOCK)
    checkMenuStep(input)
    const saved = saveMenuStep(input)
    releaseLockStep({ key: MENUS_LOCK.key })
    return new WorkflowResponse(saved)
  }
)

/** Removes a menu with its links; undone, both come back as they were. */
const deleteMenuStep = createStep(
  "storefront-menu-delete",
  async (id: string, { container }) => {
    const service = menus(container)
    const snapshot = await snapshotOf(service, id)
    if (!snapshot) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "storefront_menus.unknown")
    }
    await service.deleteStorefrontMenus(id)
    return new StepResponse({ id }, snapshot)
  },
  async (snapshot, { container }) => {
    if (!snapshot) {
      return
    }
    const service = menus(container)
    await service.createStorefrontMenus(snapshot.menu)
    if (snapshot.items.length > 0) {
      await service.createStorefrontMenuItems(parentsFirst(snapshot.items))
    }
  }
)

export const deleteStorefrontMenuWorkflow = createWorkflow(
  "storefront-menu-delete",
  (id: string) => {
    acquireLockStep(MENUS_LOCK)
    const deleted = deleteMenuStep(id)
    releaseLockStep({ key: MENUS_LOCK.key })
    return new WorkflowResponse(deleted)
  }
)
