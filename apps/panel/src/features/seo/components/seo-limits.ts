// What search results show before cutting (docs/13 §3)
export const TITLE_LIMIT = 60
export const DESCRIPTION_LIMIT = 155
// The longest the server keeps (SEO_META_LIMITS): typing stops there, the save is never refused
export const SEO_MAX = { title: 150, description: 320, keyword: 100 } as const
