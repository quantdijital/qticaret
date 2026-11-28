import { Migration } from "@medusajs/framework/mikro-orm/migrations"

/**
 * F16.7: a custom domain's DNS check. Its token, the last check's reason,
 * when it was proved, checked and is checked next; `active` joins the
 * states. Custom domains recorded before get a token and a check now.
 */
export class Migration20261128211947 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "tenant_domain" drop constraint if exists "tenant_domain_verification_check";`
    )
    this.addSql(
      `alter table if exists "tenant_domain" add constraint "tenant_domain_verification_check" check ("verification" in ('pending', 'verified', 'active', 'failed'));`
    )
    this.addSql(
      `alter table if exists "tenant_domain" add column if not exists "verification_token" text null, add column if not exists "verification_error" text check ("verification_error" in ('txt_missing', 'txt_mismatch', 'dns_unavailable', 'expired', 'txt_lost', 'routing_missing', 'routing_mismatch')) null, add column if not exists "verified_at" timestamptz null, add column if not exists "last_checked_at" timestamptz null, add column if not exists "next_check_at" timestamptz null, add column if not exists "check_attempts" integer not null default 0;`
    )
    this.addSql(
      `CREATE INDEX IF NOT EXISTS "IDX_tenant_domain_next_check_at" ON "tenant_domain" ("next_check_at") WHERE next_check_at IS NOT NULL AND deleted_at IS NULL;`
    )
    this.addSql(
      `update "tenant_domain" set "verification_token" = replace(gen_random_uuid()::text, '-', ''), "next_check_at" = now() where "kind" = 'custom' and "verification_token" is null and "deleted_at" is null;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "IDX_tenant_domain_next_check_at";`)
    this.addSql(
      `alter table if exists "tenant_domain" drop column if exists "verification_token", drop column if exists "verification_error", drop column if exists "verified_at", drop column if exists "last_checked_at", drop column if exists "next_check_at", drop column if exists "check_attempts";`
    )
    this.addSql(
      `update "tenant_domain" set "verification" = 'verified' where "verification" = 'active';`
    )
    this.addSql(
      `alter table if exists "tenant_domain" drop constraint if exists "tenant_domain_verification_check";`
    )
    this.addSql(
      `alter table if exists "tenant_domain" add constraint "tenant_domain_verification_check" check ("verification" in ('pending', 'verified', 'failed'));`
    )
  }
}
