import { useCan } from "@/features/auth/api/staff"

/** Whether the person may write pop-ups: owner and admin (adr/0080 §8, the `marketing` capability). */
export const useCanWritePopups = (): boolean => useCan("marketing")
