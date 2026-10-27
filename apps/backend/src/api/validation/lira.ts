import { z } from "@medusajs/framework/zod"
import { kurus } from "../../lib/money"
import type { Kurus } from "../../lib/money"

/** Lira as the panel sends it, with at most two decimals: kuruş are whole. */
export const liraAmount = (max: number, message: string) =>
  z
    .number()
    .positive()
    .max(max)
    .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6, message)

export const liraToKurus = (lira: number): Kurus => kurus(Math.round(lira * 100))
