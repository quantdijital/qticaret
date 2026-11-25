import { Migration } from "@medusajs/framework/mikro-orm/migrations"

/**
 * The limit key `ai_free_credits_per_month` (adr/0085 K5): the AI platform
 * credits a package gives each month, and a shop's exception to it. Down
 * removes the rows holding the key first (they would break the check),
 * then puts the old check back.
 */
export class Migration20261125004004 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "package_limit" drop constraint if exists "package_limit_key_check";`
    )
    this.addSql(
      `alter table if exists "tenant_override" drop constraint if exists "tenant_override_key_check";`
    )
    this.addSql(
      `alter table if exists "package_limit" add constraint "package_limit_key_check" check("key" in ('products', 'orders_per_month', 'staff', 'storage_mb', 'llm_credits_per_month', 'custom_domains', 'ai_free_credits_per_month'));`
    )
    this.addSql(
      `alter table if exists "tenant_override" add constraint "tenant_override_key_check" check("key" in ('products', 'orders_per_month', 'staff', 'storage_mb', 'llm_credits_per_month', 'custom_domains', 'ai_free_credits_per_month'));`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`delete from "package_limit" where "key" = 'ai_free_credits_per_month';`)
    this.addSql(`delete from "tenant_override" where "key" = 'ai_free_credits_per_month';`)
    this.addSql(
      `alter table if exists "package_limit" drop constraint if exists "package_limit_key_check";`
    )
    this.addSql(
      `alter table if exists "tenant_override" drop constraint if exists "tenant_override_key_check";`
    )
    this.addSql(
      `alter table if exists "package_limit" add constraint "package_limit_key_check" check("key" in ('products', 'orders_per_month', 'staff', 'storage_mb', 'llm_credits_per_month', 'custom_domains'));`
    )
    this.addSql(
      `alter table if exists "tenant_override" add constraint "tenant_override_key_check" check("key" in ('products', 'orders_per_month', 'staff', 'storage_mb', 'llm_credits_per_month', 'custom_domains'));`
    )
  }
}
