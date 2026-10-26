import { join } from "node:path"

/** Where e2e keeps what one run needs: the signed-in session and the temporary admin's address (gitignored). */
export const E2E_DIR = import.meta.dirname.replace(/\/support$/, "")
export const AUTH_DIR = join(E2E_DIR, ".auth")
export const SESSION_FILE = join(AUTH_DIR, "session.json")
export const ADMIN_FILE = join(AUTH_DIR, "admin.json")
export const REPO_ROOT = join(E2E_DIR, "..", "..", "..")
