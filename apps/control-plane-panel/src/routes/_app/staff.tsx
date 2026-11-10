import { createFileRoute } from "@tanstack/react-router"
import { StaffPage } from "@/features/staff/pages/staff-page"
import { requireOwner } from "../-require-member"

/** The platform's staff: the owner's alone (adr/0061 §3.5). */
export const Route = createFileRoute("/_app/staff")({
  beforeLoad: ({ context }) => {
    requireOwner(context.me)
  },
  component: StaffPage,
})
