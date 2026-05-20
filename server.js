const { createApp } = require('./src/app');
const { initDb } = require('./src/config/database');

const app = createApp();

// For local development
if (require.main === module) {
  const PORT = process.env.PORT || 3001;
  initDb().then(() => {
    app.listen(PORT, () => {
      console.log(`School app running at http://localhost:${PORT}`);
    });
  }).catch((err) => {
    console.error('Failed to start app:', err);
    process.exit(1);
  });
}

// For Vercel Serverless Function
module.exports = async (req, res) => {
  await initDb();
  return app(req, res);
};
