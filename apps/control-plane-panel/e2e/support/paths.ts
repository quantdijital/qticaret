import { join } from "node:path"

/** Where one run keeps its session and its temporary owner's details (gitignored, removed by the teardown). */
export const E2E_DIR = import.meta.dirname.replace(/\/support$/, "")
export const AUTH_DIR = join(E2E_DIR, ".auth")
export const SESSION_FILE = join(AUTH_DIR, "session.json")
export const OWNER_FILE = join(AUTH_DIR, "owner.json")
export const REPO_ROOT = join(E2E_DIR, "..", "..", "..")
