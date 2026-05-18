const { createApp } = require('./src/app');
const { initDb } = require('./src/config/database');

const PORT = process.env.PORT || 3001;

async function start() {
  await initDb();
  const app = createApp();
  app.listen(PORT, () => {
    console.log(`School app running at http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error('Failed to start app:', err);
  process.exit(1);
});
