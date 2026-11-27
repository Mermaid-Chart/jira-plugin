#!/usr/bin/env node

import http from 'node:http';
import app from '../api/index.js';
import log from '../utils/logger.js';

// Local server. On Vercel, api/index.js is used directly.
const server = http.createServer(app);
server.listen(app.get('port'), () => {
  log.info(`App server running at http://${server.address().address}:${server.address().port}`);
});
