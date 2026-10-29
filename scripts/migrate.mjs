// Draait alle migrations/*.sql in volgorde, één keer, bijgehouden in schema_migrations.
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL ontbreekt");
  process.exit(1);
}

const dir = path.resolve(process.cwd(), "migrations");
const client = new pg.Client({ connectionString: url });

async function waitForDb() {
  for (let i = 0; i < 60; i++) {
    try {
      await client.connect();
      return;
    } catch (err) {
      console.log(`Database nog niet bereikbaar (${err.code ?? err.message}), opnieuw over 2s`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  throw new Error("Database niet bereikbaar na 2 minuten");
}

await waitForDb();
await client.query(
  "create table if not exists schema_migrations (name text primary key, applied_at timestamptz not null default now())",
);
const applied = new Set(
  (await client.query("select name from schema_migrations")).rows.map((r) => r.name),
);
const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();
for (const file of files) {
  if (applied.has(file)) continue;
  const sql = await readFile(path.join(dir, file), "utf8");
  console.log(`Migratie ${file}`);
  await client.query("begin");
  try {
    await client.query(sql);
    await client.query("insert into schema_migrations (name) values ($1)", [file]);
    await client.query("commit");
  } catch (err) {
    await client.query("rollback");
    console.error(`Migratie ${file} mislukt:`, err.message);
    process.exit(1);
  }
}
await client.end();
console.log(`Migraties klaar (${files.length} bestanden, ${files.length - applied.size} nieuw)`);
