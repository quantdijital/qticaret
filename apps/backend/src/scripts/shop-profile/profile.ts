import { readFile } from "node:fs/promises"
import path from "node:path"
import { z } from "@medusajs/framework/zod"
import { isSectionName } from "../../modules/platform-settings/sections"
import type { SectionName } from "../../modules/platform-settings/sections"

/**
 * A shop profile (F18): what a new shop's instance starts from, as files a
 * person can read and review: its name, settings sections, content pages
 * as Markdown and, optionally, a migration bundle (categories, brands, old
 * addresses). Every value still goes through the platform's own checks:
 * section schemas, the content document, the migration's validation.
 */
export const PROFILE_FORMAT = "quant-shop-profile"

const relativeFile = z
  .string()
  .min(1)
  .max(255)
  .refine((value) => !path.isAbsolute(value), {
    message: "a profile names files relative to itself",
  })

const handle = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  .max(80)

const profileSchema = z.strictObject({
  format: z.literal(PROFILE_FORMAT),
  version: z.literal(1),
  store_name: z.string().trim().min(1).max(120).optional(),
  /** The old site's host: its absolute links in the pages become paths here. */
  site_host: z.string().trim().max(253).optional(),
  sections: z
    .record(z.string(), z.record(z.string(), z.unknown()))
    .refine((sections) => Object.keys(sections).every(isSectionName), {
      message: "unknown settings section",
    })
    .default({}),
  pages: z
    .array(
      z.strictObject({
        handle,
        title: z.string().trim().min(1).max(255),
        file: relativeFile,
        status: z.enum(["published", "draft"]).default("published"),
      })
    )
    .max(200)
    .default([]),
  /**
   * Pages an earlier version of the profile made that it no longer wants,
   * removed by their handle if present: a legal text belongs to the legal
   * texts (F13, published under `/yasal`), never to a content page.
   */
  retired_pages: z.array(handle).max(200).default([]),
  /**
   * The storefront's menus (adr/0049), links written as addresses: a
   * record's path becomes a link to the record when the profile is loaded.
   */
  menus: z
    .array(
      z.strictObject({
        title: z.string().trim().min(1).max(60),
        location: z.enum(["main", "top", "footer"]),
        items: z
          .array(
            z.strictObject({
              label: z.string().trim().min(1).max(60),
              href: z.string().trim().min(1).max(2048),
              children: z
                .array(
                  z.strictObject({
                    label: z.string().trim().min(1).max(60),
                    href: z.string().trim().min(1).max(2048),
                  })
                )
                .max(20)
                .default([]),
            })
          )
          .max(30),
      })
    )
    .max(10)
    .default([]),
  /** A migration bundle (`quant-migration`) queued as a run that applies. */
  bundle: relativeFile.optional(),
})

export type ShopProfile = z.infer<typeof profileSchema> & {
  sections: Partial<Record<SectionName, Record<string, unknown>>>
}

export interface LoadedProfile {
  profile: ShopProfile
  /** The folder the profile's files are named from. */
  dir: string
}

/** A profile's `profil.json` as read; a wrong one throws, naming the field. */
export function parseProfile(value: unknown, file = "profil.json"): ShopProfile {
  const parsed = profileSchema.safeParse(value)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    throw new Error(
      `shop profile: ${file} ${issue?.path.map(String).join(".") ?? ""}: ${issue?.message ?? ""}`
    )
  }
  const { data } = parsed
  const kept = new Set(data.pages.map((page) => page.handle))
  const both = data.retired_pages.find((handle) => kept.has(handle))
  if (both) {
    throw new Error(`shop profile: ${file} retired_pages: ${both} is also a page`)
  }
  return data
}

export async function readProfile(dir: string): Promise<LoadedProfile> {
  const file = path.join(dir, "profil.json")
  return { profile: parseProfile(JSON.parse(await readFile(file, "utf8")), file), dir }
}

/** A profile's file, which must stay inside the profile's folder tree's parent. */
export async function profileFile(loaded: LoadedProfile, name: string): Promise<string> {
  const root = path.resolve(loaded.dir, "..")
  const target = path.resolve(loaded.dir, name)
  if (!target.startsWith(`${root}${path.sep}`)) {
    throw new Error(`shop profile: ${name} is outside the profile's folder`)
  }
  return readFile(target, "utf8")
}

/**
 * A captured page's text without the capture's notes: a page saved from
 * the old site starts with its source and meta lines, then a `---` line.
 * A file without such a head is taken whole.
 */
export function pageBody(text: string): string {
  const lines = text.replace(/\r\n?/g, "\n").split("\n")
  const rule = lines.findIndex((line, index) => index < 20 && line.trim() === "---")
  if (rule === -1) {
    return text
  }
  const head = lines.slice(0, rule)
  const notes = head.every(
    (line) => line.trim() === "" || line.startsWith(">") || line.startsWith("Kaynak:")
  )
  return notes ? lines.slice(rule + 1).join("\n") : text
}
