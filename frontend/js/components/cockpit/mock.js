// 화면 미리보기용 예시 데이터. 비행 로직과 주변 정보 API가 생기면 이 값을 대체한다
export const MOCK_FLIGHT = {
  heading: 72,
  bank: 0,
  pitch: 0,
  thrust: 0.55,
  speed: 211,
  altitude: 3500
};

// 시안색 목표 표시(방위·속도)
export const MOCK_TARGET = { heading: 90, speed: 220 };

// Kakao 로컬 카테고리 코드: AT4 관광명소, FD6 음식점, AD5 숙박
export const PLACE_CATEGORIES = {
  AT4: { label: '관광명소', glyph: '관' },
  FD6: { label: '음식점', glyph: '식' },
  AD5: { label: '숙소', glyph: '숙' }
};

// 현재 위치(서울시청) 기준 진북 방위(도)와 거리(km)
export const MOCK_PLACES = [
  { name: '덕수궁', category: 'AT4', bearing: 252, distance: 0.3 },
  { name: '청계천', category: 'AT4', bearing: 32, distance: 0.4 },
  { name: '숭례문', category: 'AT4', bearing: 214, distance: 0.9 },
  { name: '경복궁', category: 'AT4', bearing: 352, distance: 1.6 },
  { name: '무교동 낙지 골목', category: 'FD6', bearing: 78, distance: 0.3 },
  { name: '서소문 식당가', category: 'FD6', bearing: 268, distance: 0.5 },
  { name: '명동 칼국수 거리', category: 'FD6', bearing: 128, distance: 0.8 },
  { name: '을지로 시티 호텔', category: 'AD5', bearing: 108, distance: 1.0 },
  { name: '서울역 비즈니스 호텔', category: 'AD5', bearing: 204, distance: 1.5 },
  { name: '북촌 한옥 스테이', category: 'AD5', bearing: 38, distance: 1.8 }
];

export const NEARBY_RANGE_KM = 2;
