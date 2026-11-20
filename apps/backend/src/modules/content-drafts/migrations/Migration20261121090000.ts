import { Migration } from "@medusajs/framework/mikro-orm/migrations"

/**
 * adr/0074 §4 (security review of PR 237, B2): which candidate of an AI
 * suggestion was accepted. Written by hand (no env in the agent's
 * worktree) in the form `db:generate` gives; nullable, so rows decided
 * before it read as they did.
 */
export class Migration20261121090000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "content_draft" add column if not exists "accepted_index" integer null;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "content_draft" drop column if exists "accepted_index";`)
  }
}
