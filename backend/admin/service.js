import { requireAdmin } from './access.js';

// 서비스 기준 시간대는 한국 표준시(UTC+9, 일광절약시간 없음)
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

export function kstPeriodStarts(time) {
  const local = new Date(time + KST_OFFSET_MS);
  const day = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - KST_OFFSET_MS;
  const month = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) - KST_OFFSET_MS;
  return { day, month };
}

export function createAdminService({ admin, auth, now = Date.now }) {
  return {
    dashboard(token) {
      requireAdmin(auth, token);
      const time = now();
      const { day, month } = kstPeriodStarts(time);
      return {
        summary: {
          members: { total: admin.countMembers(), today: admin.countMembers(day), active: admin.countActiveMembers(time) },
          posts: { total: admin.countPosts(), month: admin.countPosts(month), today: admin.countPosts(day) }
        },
        members: admin.members()
      };
    }
  };
}
