import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261110212907 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "cp_staff_member" add column if not exists "enrol_by" timestamptz null, add column if not exists "enrol_token_hash" text null, add column if not exists "bootstrap" boolean not null default false, add column if not exists "mfa_valid_after" timestamptz null, add column if not exists "tokens_valid_after" timestamptz null;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "cp_staff_member" drop column if exists "enrol_by", drop column if exists "enrol_token_hash", drop column if exists "bootstrap", drop column if exists "mfa_valid_after", drop column if exists "tokens_valid_after";`
    )
  }
}
