// Static class names, so Tailwind sees each one
export const SPANS = {
  3: "xl:col-span-3",
  4: "xl:col-span-4",
  5: "xl:col-span-5",
  6: "xl:col-span-6",
  7: "xl:col-span-7",
  8: "xl:col-span-8",
  9: "xl:col-span-9",
  12: "xl:col-span-12",
} as const

export type Span = keyof typeof SPANS

/** The column span for a card placed straight in a PageGrid. */
export const spanOf = (span: Span): string => SPANS[span]
