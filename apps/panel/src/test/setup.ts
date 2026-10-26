import { cleanup } from "@testing-library/react"
import { afterEach } from "vitest"
import "@testing-library/jest-dom/vitest"

// Without vitest globals Testing Library cannot clean up by itself
afterEach(() => {
  cleanup()
})
