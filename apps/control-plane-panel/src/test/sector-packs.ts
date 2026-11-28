import type { SectorPackSummary } from "@/features/sector-packs/api"

/** The sector packs as the control plane lists them (C12), the general one first. */
export const GENERAL: SectorPackSummary = {
  code: "general",
  version: 1,
  name: "Genel",
  description: "Her sektöre uyan sade bir başlangıç.",
  counts: {
    attribute_templates: 1,
    attributes: 5,
    categories: 0,
    flags: 0,
    seo_templates: 0,
    presets: 0,
  },
  presets: [],
}

export const CUTLERY: SectorPackSummary = {
  code: "cutlery",
  version: 2,
  name: "Bıçak ve çatal-bıçak",
  description: "Çakı, av, kamp, mutfak ve kasap bıçağı satan mağazalar için.",
  counts: {
    attribute_templates: 2,
    attributes: 31,
    categories: 16,
    flags: 2,
    seo_templates: 1,
    presets: 2,
  },
  presets: [
    {
      code: "katalog",
      version: 5,
      name: "Katalog",
      description: "Sık bir mağaza ana sayfası: solda kategori listesi, sekmeli raflar.",
      tone: "light",
      preview: true,
    },
    {
      code: "tezgah",
      version: 3,
      name: "Tezgâh",
      description: "Geniş açılış görseli ve öne çıkan ürünler.",
      tone: "light",
      preview: false,
    },
  ],
}

export const SECTOR_PACKS = { sector_packs: [GENERAL, CUTLERY] }
