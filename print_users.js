const { db, initDb } = require('./src/config/database');

async function main() {
  try {
    await initDb();
    const [rows] = await db().query('SELECT id, username, role, display_name FROM users');
    console.log(JSON.stringify(rows, null, 2));
  } catch (err) {
    console.error(err);
  }
  process.exit();
}

main();
