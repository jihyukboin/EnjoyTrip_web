import { getPost } from '../../api/post-api.js';
import { bearingDegrees } from './navigation.js';

function locate(address) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('주소 위치 조회가 지연되고 있습니다. 다시 시도해주세요.')), 15000);
    new kakao.maps.services.Geocoder().addressSearch(address, (results, status) => {
      clearTimeout(timer);
      if (status !== kakao.maps.services.Status.OK || !results.length) {
        reject(new Error('출발지 또는 도착지 위치를 찾지 못했습니다. 게시글의 주소를 확인해주세요.'));
        return;
      }
      resolve({ lat: Number(results[0].y), lng: Number(results[0].x) });
    });
  });
}

export async function loadTrip() {
  const id = location.pathname.split('/').at(-1);
  const post = await getPost(id);
  if (!post.origin || !post.destination) throw new Error('출발지와 도착지가 없는 게시글입니다. 게시글에서 주소를 먼저 설정해주세요.');
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('카카오 지도를 불러오지 못했습니다. 다시 시도해주세요.')), 15000);
    if (!globalThis.kakao?.maps?.load) { clearTimeout(timer); reject(new Error('카카오 지도를 불러오지 못했습니다.')); return; }
    kakao.maps.load(() => { clearTimeout(timer); resolve(); });
  });
  const [start, end] = await Promise.all([locate(post.origin), locate(post.destination)]);
  return { post, start, end, heading: bearingDegrees(start, end) };
}
