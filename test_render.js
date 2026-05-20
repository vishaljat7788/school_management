const { db, initDb } = require('./src/config/database');
const resultsController = require('./src/controllers/resultsController');

async function main() {
  await initDb();
  const req = {
    session: {
      user: {
        id: 1,
        role: 'admin',
        display_name: 'Admin'
      }
    },
    query: {}
  };
  const res = {
    send: (html) => {
      console.log('--- HTML OUTPUT START ---');
      console.log(html);
      console.log('--- HTML OUTPUT END ---');
    }
  };
  await resultsController.results(req, res);
  process.exit();
}

main();
