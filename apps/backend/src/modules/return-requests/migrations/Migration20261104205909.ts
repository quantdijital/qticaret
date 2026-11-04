import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261104205909 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "return_request" add column if not exists "canceled_at" timestamptz null, add column if not exists "canceled_by" text null, add column if not exists "cancel_cause" text check ("cancel_cause" in ('staff', 'order_canceled')) null, add column if not exists "cancel_reason" text null;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "return_request" drop column if exists "canceled_at", drop column if exists "canceled_by", drop column if exists "cancel_cause", drop column if exists "cancel_reason";`
    )
  }
}
