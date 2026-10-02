// 비행 계기 초기값
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

// 패널 분류 코드. 서버에서 관광정보 서비스의 콘텐츠 유형을 여기에 맞춰 변환한다.
export const PLACE_CATEGORIES = {
  AT4: { label: '관광명소', glyph: '관' },
  FD6: { label: '음식점', glyph: '식' },
  AD5: { label: '숙소', glyph: '숙' }
};

export const NEARBY_RANGE_KM = 2;
