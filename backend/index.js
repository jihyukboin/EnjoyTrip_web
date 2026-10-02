import { createServer } from 'node:http';
import { createRequestHandler } from './app.js';
import { readConfig } from './config.js';
import { openDatabase } from './db/database.js';
import { createApi } from './api.js';
import { createSessionReader } from './auth/session-reader.js';
import { createNoticeBannerReader } from './notices/banner-reader.js';

const config = readConfig();
const { host, port } = config;
const db = openDatabase(config.databasePath);

const server = createServer(createRequestHandler({
  apiHandler: createApi({ db, config }),
  readSession: createSessionReader({ db }),
  readNotice: createNoticeBannerReader({ db })
}));
server.once('close', () => { if (db.isOpen) db.close(); });

server.on('error', (error) => {
  console.error('서버를 실행하지 못했습니다:', error.message);
  process.exitCode = 1;
  if (db.isOpen) db.close();
});

let stopping = false;
const shutdown = () => {
  if (stopping) return;
  stopping = true;
  server.close();
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

server.listen(port, host, () => {
  console.log(`EnjoyTrip: http://${host}:${port}`);
});
