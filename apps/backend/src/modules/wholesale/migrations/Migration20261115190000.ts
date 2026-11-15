import { Migration } from "@medusajs/framework/mikro-orm/migrations"

/**
 * ADR-0068 slice 1b security review L2: how many times a pending
 * wholesaler's invitation went out (the first counts), so a resend is
 * capped. Written by hand (no env in the agent's worktree); `medusa
 * db:generate wholesale` against it should report no changes.
 */
export class Migration20261115190000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "wholesale_account" add column if not exists "invite_count" integer not null default 1;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "wholesale_account" drop column if exists "invite_count";`)
  }
}
