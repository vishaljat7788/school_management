const express = require('express');
const path = require('path');
const session = require('express-session');
const authRoutes = require('./routes/authRoutes');
const pageRoutes = require('./routes/pageRoutes');

const { initDb } = require('./config/database');

function createApp() {
  const app = express();

  app.use(async (req, res, next) => {
    try {
      await initDb();
      next();
    } catch (err) {
      console.error('Database connection failed:', err);
      res.status(500).send('Database connection error');
    }
  });

  app.use(express.urlencoded({ extended: true }));
  app.use(express.static(path.join(__dirname, '..', 'public')));
  app.use(session({
    secret: process.env.SESSION_SECRET || 'school-local-secret',
    resave: false,
    saveUninitialized: false,
  }));

  app.use(authRoutes);
  app.use(pageRoutes);

  app.use((req, res) => {
    res.status(404).send('Page not found');
  });

  return app;
}

module.exports = { createApp };
