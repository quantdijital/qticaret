import type { Collection } from "@/features/collections/api/collections"

/** A collection as `/admin/collection-board` answers, for the screen's specs. */
export const collectionFixture = (more: Partial<Collection> = {}): Collection => ({
  id: "pcol_1",
  title: "Yaz Seçkisi",
  handle: "yaz-seckisi",
  description: "Yazın en sevilenleri.",
  description_doc: null,
  is_active: true,
  image: null,
  product_count: 2,
  created_at: "2026-11-01T00:00:00.000Z",
  updated_at: "2026-11-01T00:00:00.000Z",
  ...more,
})
