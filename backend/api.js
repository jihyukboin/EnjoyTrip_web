import { createMemberRepository } from './members/repository.js';
import { createMemberService } from './members/service.js';
import { createAuthRepository } from './auth/repository.js';
import { createAuthService } from './auth/service.js';
import { createResetDelivery } from './auth/reset-delivery.js';
import { createApiRouter } from './http/api-router.js';

export function createApi({ db, config, now = Date.now, deliverReset = createResetDelivery(config), rateLimit }) {
  const members = createMemberRepository(db);
  const auth = createAuthRepository(db);
  const authService = createAuthService({ db, members, auth, now, deliverReset });
  const memberService = createMemberService({ db, members, authService, now });
  return createApiRouter({ config, members: memberService, auth: authService, now, rateLimit });
}
