import { createServer } from 'node:http';
import { handleRequest } from './app.js';

const host = process.env.HOST ?? '127.0.0.1';
const port = Number(process.env.PORT ?? 3000);

const server = createServer(handleRequest);

server.on('error', (error) => {
  console.error('서버를 실행하지 못했습니다:', error.message);
  process.exitCode = 1;
});

server.listen(port, host, () => {
  console.log(`EnjoyTrip: http://${host}:${port}`);
});
