// cPanel/Passenger entry point. Passenger loads this file directly (not
// `next start`) and expects it to start an HTTP server listening on the
// port Passenger assigns via process.env.PORT. This is the standard,
// documented pattern for running Next.js under cPanel's Passenger Node.js
// application manager — Render (the previous host) ran `next start`
// directly instead, since Render's runtime spawns the app's own start
// script rather than requiring a Passenger-compatible entry file.
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();
const port = process.env.PORT || 3000;

app
  .prepare()
  .then(() => {
    createServer((req, res) => {
      const parsedUrl = parse(req.url, true);
      handle(req, res, parsedUrl);
    }).listen(port, (err) => {
      if (err) throw err;
      console.log(`> Ready on port ${port}`);
    });
  })
  .catch((err) => {
    console.error('Failed to start Next.js server:', err);
    process.exit(1);
  });
