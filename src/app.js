const express = require('express');
const path = require('path');
const session = require('express-session');
const authRoutes = require('./routes/authRoutes');
const pageRoutes = require('./routes/pageRoutes');

function createApp() {
  const app = express();

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
