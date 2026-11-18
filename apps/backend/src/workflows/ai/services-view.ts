import type { MedusaContainer } from "@medusajs/framework/types"
import type { AiCapability } from "../../lib/ai/registry/capabilities"
import { aiServices } from "../../lib/ai/registry/services"
import type { AiFunding, AiTarget } from "../../lib/ai/registry/services"
import { IMAGE_SCENE_TASK, aiTasks } from "../../lib/ai/registry/tasks"
import { shopScenes } from "../../lib/ai/scenes"
import { canRunTask, usableServices } from "../../lib/ai/select"
import type { AiConnectionStatus } from "../../lib/ai/select"
import { AI_MODULE } from "../../modules/ai"
import type AiModuleService from "../../modules/ai/service"
import { STAFF_ROLES_MODULE } from "../../modules/staff-roles"
import type StaffRolesModuleService from "../../modules/staff-roles/service"
import { aiConnectionsOf, aiFlagsOf, taskFlagOpen } from "./connections"

export interface AiServiceView {
  id: string
  capabilities: AiCapability[]
  /** An account's state only; `not_connected` when the shop has none. */
  status: AiConnectionStatus | "not_connected"
  funding: AiFunding
  data_note_key: string
  /** The backgrounds its `image_edit` endpoint makes (`image_background` options); empty without one. */
  backgrounds: string[]
  /** It can set a product photo in a scene (`image_scene`). */
  scene: boolean
}

/** A scene as the picker shows it: its code and names; never its prompt. */
export interface AiSceneView {
  code: string
  name: { tr: string; en: string }
}

export interface AiTaskView {
  id: string
  capability: AiCapability
  mode: "sync" | "job"
  options: readonly string[]
  /** Whether the staff member asking may use it (the task's roles, and its flag when it has one). */
  allowed: boolean
  /** What `usableServices` gives, registry order; the picker shows only with two or more. */
  usable: string[]
  preference: string | null
  /** `image_scene`: the shop's scenes (its `options`, by code), from its sector packs. */
  scenes?: AiSceneView[]
}

export interface AiServicesView {
  services: AiServiceView[]
  tasks: AiTaskView[]
  flags: { own_keys: boolean }
}

const backgroundsOf = (target: AiTarget | undefined): string[] =>
  target && "backgrounds" in target ? [...target.backgrounds] : []

/**
 * `GET /admin/ai/services` (adr/0071 §3, §11): the registry's services
 * with each account reduced to its state (no key, nor any part of one),
 * each task's usable services as `usableServices` decides them and the
 * remembered choice, and whether the package opens the shop's own key.
 */
export async function aiServicesView(
  container: Pick<MedusaContainer, "resolve">,
  userId: string
): Promise<AiServicesView> {
  const [connections, flags, role] = await Promise.all([
    aiConnectionsOf(container),
    aiFlagsOf(container),
    container.resolve<StaffRolesModuleService>(STAFF_ROLES_MODULE).roleOf(userId),
  ])
  const ai = container.resolve<AiModuleService>(AI_MODULE)
  const services = aiServices().map((service): AiServiceView => ({
    id: service.id,
    capabilities: Object.keys(service.capabilities) as AiCapability[],
    status:
      connections.find((each) => each.provider === service.credentialProvider)?.status ??
      "not_connected",
    funding: service.funding,
    data_note_key: service.dataNoteKey,
    backgrounds: backgroundsOf(service.capabilities.image_edit),
    scene: canRunTask(service, IMAGE_SCENE_TASK),
  }))
  const scenes: AiSceneView[] = (await shopScenes(container)).map((scene) => ({
    code: scene.code,
    name: { tr: scene.name.tr, en: scene.name.en },
  }))
  const tasks = await Promise.all(
    aiTasks().map(async (task): Promise<AiTaskView> => ({
      id: task.id,
      capability: task.capability,
      mode: task.mode,
      options: task.optionSource === "scenes" ? scenes.map((scene) => scene.code) : task.options,
      ...(task.optionSource === "scenes" ? { scenes } : {}),
      // The task's own flag too (`ai.reviews`): off, the panel draws no button for it
      allowed: role !== null && task.roles.includes(role) && (await taskFlagOpen(container, task)),
      usable: usableServices(task, connections, flags).map((service) => service.id),
      preference: await ai.preferenceOf(userId, task.id),
    }))
  )
  return { services, tasks, flags: { own_keys: flags.ownKeys } }
}
