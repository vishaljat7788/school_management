const { createApp } = require('../src/app');
const { initDb } = require('../src/config/database');

const app = createApp();

module.exports = async (req, res) => {
  await initDb();
  return app(req, res);
};
