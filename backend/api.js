import { createMemberRepository } from './members/repository.js';
import { createMemberService } from './members/service.js';
import { createAuthRepository } from './auth/repository.js';
import { createAuthService } from './auth/service.js';
import { createPostRepository } from './posts/repository.js';
import { createPostService } from './posts/service.js';
import { createPostRoutes } from './posts/routes.js';
import { createAdminRepository } from './admin/repository.js';
import { createAdminService } from './admin/service.js';
import { createAdminRoutes } from './admin/routes.js';
import { createNoticeRepository } from './notices/repository.js';
import { createNoticeService } from './notices/service.js';
import { createNoticeRoutes } from './notices/routes.js';
import { createApiRouter } from './http/api-router.js';
import { createNearbyService } from './nearby/service.js';
import { createNearbyRoutes } from './nearby/routes.js';
import { createFlightRoutes } from './flights/routes.js';

export function createApi({ db, config, now = Date.now, rateLimit, nearby = createNearbyService({ key: config.tourApiServiceKey, now }) }) {
  const members = createMemberRepository(db);
  const auth = createAuthRepository(db);
  const authService = createAuthService({ db, members, auth, now });
  const memberService = createMemberService({ db, members, authService, now });
  const posts = createPostService({ posts: createPostRepository(db), auth: authService, now });
  const admin = createAdminService({ admin: createAdminRepository(db), auth: authService, now });
  const notices = createNoticeService({ notices: createNoticeRepository(db), auth: authService, now });
  const extraRoutes = new Map([
    ...createPostRoutes({ posts, auth: authService }),
    ...createAdminRoutes({ admin }),
    ...createNoticeRoutes({ notices }),
    ...createNearbyRoutes({ nearby }),
    ...createFlightRoutes({ db, auth: authService, posts, now })
  ]);
  return createApiRouter({ config, members: memberService, auth: authService, now, rateLimit, extraRoutes });
}
