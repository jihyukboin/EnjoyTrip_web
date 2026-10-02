import { sendJson } from '../http/api-response.js';

export function createAdminRoutes({ admin }) {
  return new Map([['/api/admin/dashboard', new Map([['GET', {
    action(body, token, response) {
      sendJson(response, 200, { data: admin.dashboard(token) });
    }
  }]])]]);
}
