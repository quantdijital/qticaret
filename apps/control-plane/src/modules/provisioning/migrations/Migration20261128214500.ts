import { Migration } from "@medusajs/framework/mikro-orm/migrations"

/** Audit 3.2: a run of kind `backup` ("Şimdi yedekle"). */
export class Migration20261128214500 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "provisioning_run" drop constraint if exists "provisioning_run_kind_check";`
    )

    this.addSql(
      `alter table if exists "provisioning_run" add constraint "provisioning_run_kind_check" check("kind" in ('create', 'upgrade', 'apply_pack', 'rotate_keys', 'stop', 'start', 'invite', 'close', 'backup'));`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`delete from "provisioning_run" where "kind" = 'backup';`)

    this.addSql(
      `alter table if exists "provisioning_run" drop constraint if exists "provisioning_run_kind_check";`
    )

    this.addSql(
      `alter table if exists "provisioning_run" add constraint "provisioning_run_kind_check" check("kind" in ('create', 'upgrade', 'apply_pack', 'rotate_keys', 'stop', 'start', 'invite', 'close'));`
    )
  }
}
