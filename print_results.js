const { db, initDb } = require('./src/config/database');

async function main() {
  try {
    await initDb();
    const [rows] = await db().query('SELECT * FROM results');
    console.log(JSON.stringify(rows, null, 2));
  } catch (err) {
    console.error(err);
  }
  process.exit();
}

main();
