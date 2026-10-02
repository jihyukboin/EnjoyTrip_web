// 계기 숫자 표기. 방위는 항공 관례대로 세 자리(001~360)로 쓴다
const numberFormat = new Intl.NumberFormat('ko-KR');

export const normalizeDegrees = degrees => ((degrees % 360) + 360) % 360;

export const formatHeading = degrees => String(Math.round(normalizeDegrees(degrees)) % 360 || 360).padStart(3, '0');

export const formatNumber = value => numberFormat.format(Math.round(value));

export const formatDistance = km => (km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)}km`);

// 기수 기준 상대 방위를 조종사 교신식 시계 방향(1~12시)으로 바꾼다
export function clockPosition(bearing, heading) {
  const relative = normalizeDegrees(bearing - heading);
  return Math.round(relative / 30) % 12 || 12;
}
