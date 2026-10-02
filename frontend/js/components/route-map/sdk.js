import { request } from '../../api/client.js';

let loading;

// 필요한 화면에서 한 번만 지도·주소 좌표 변환 SDK를 불러온다.
export function loadKakaoMaps() {
  if (globalThis.kakao?.maps?.services) return Promise.resolve(kakao.maps);
  loading ??= request('/api/maps/config').then(({ javascriptKey }) => new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const fail = () => {
      clearTimeout(timeout);
      script.remove();
      reject(new Error('카카오 지도를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.'));
    };
    const timeout = setTimeout(fail, 15000);
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?${new URLSearchParams({
      appkey: javascriptKey, autoload: 'false', libraries: 'services'
    })}`;
    script.onerror = fail;
    script.onload = () => {
      if (!globalThis.kakao?.maps?.load) { fail(); return; }
      kakao.maps.load(() => {
        clearTimeout(timeout);
        resolve(kakao.maps);
      });
    };
    document.head.append(script);
  })).catch(error => {
    loading = undefined;
    throw error;
  });
  return loading;
}
