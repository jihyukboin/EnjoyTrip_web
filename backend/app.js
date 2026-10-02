import { serveStatic } from './http/static.js';

export async function handleRequest(request, response) {
  try {
    await serveStatic(request, response);
  } catch (error) {
    console.error(error);
    response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Internal Server Error');
  }
}
