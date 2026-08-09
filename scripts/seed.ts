import bcrypt from "bcryptjs";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const username = process.env.ADMIN_USERNAME ?? "admin";
  const password = process.env.ADMIN_PASSWORD;

  if (!password || password.length < 12) {
    throw new Error("ADMIN_PASSWORD must be set and at least 12 characters.");
  }

  const hash = await bcrypt.hash(password, 12);

  await pool.query(
    `INSERT INTO admins (username, password_hash)
     VALUES ($1, $2)
     ON CONFLICT (username)
     DO UPDATE SET password_hash = EXCLUDED.password_hash`,
    [username, hash]
  );

  const system = await pool.query(
    `INSERT INTO key_systems (name, description)
     SELECT 'RenzyHub', 'Default RenzyHub key system'
     WHERE NOT EXISTS (SELECT 1 FROM key_systems WHERE name = 'RenzyHub')
     RETURNING id`
  );

  const systemId = system.rows[0]?.id ?? (
    await pool.query(`SELECT id FROM key_systems WHERE name = 'RenzyHub' LIMIT 1`)
  ).rows[0].id;

  console.log(`Admin: ${username}`);
  console.log(`System ID: ${systemId}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => pool.end());