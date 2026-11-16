import { Migration } from "@medusajs/framework/mikro-orm/migrations"

/**
 * ADR-0068 Ek 2026-11-15 (2), security review M4: whether the account's
 * sign-in is one staff made or took over (only then may staff set a new
 * password). Accounts from before are false: their customers proved their
 * own addresses. Written by hand (no env in the agent's worktree); `medusa
 * db:generate wholesale` against it should report no changes.
 */
export class Migration20261116090000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "wholesale_account" add column if not exists "staff_login" boolean not null default false;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "wholesale_account" drop column if exists "staff_login";`)
  }
}
