import { angleBetween, cross, lonLatToVector, normalize, slerp, subtract } from './math.js';

/*
 * 도시와 항공편 일정.
 * 비행기마다 세 도시를 순환하며, 구간마다 대원 항로를 따라 떠올랐다가 내려앉는다.
 */

export const CITIES = {
  seoul: [126.98, 37.57],
  tokyo: [139.69, 35.69],
  paris: [2.35, 48.86],
  newYork: [-74.01, 40.71],
  sydney: [151.21, -33.87],
  singapore: [103.82, 1.35],
  honolulu: [-157.86, 21.31],
  sanFrancisco: [-122.42, 37.77]
};

export const FLIGHTS = [
  { stops: ['seoul', 'paris', 'newYork'], colors: ['#f0327f', '#ff8a3d'], offset: 0 },
  { stops: ['seoul', 'sydney', 'singapore'], colors: ['#6a4dff', '#2f9bff'], offset: 4.2 },
  { stops: ['tokyo', 'honolulu', 'sanFrancisco'], colors: ['#f06a00', '#e3a800'], offset: 8.4 }
];

const LEG_BASE_SECONDS = 2.4;
const LEG_SECONDS_PER_RADIAN = 3.6;
export const GROUND_SECONDS = 1.4;
const TANGENT_STEP = 0.002;

function createLeg(from, to) {
  const start = lonLatToVector(...CITIES[from]);
  const end = lonLatToVector(...CITIES[to]);
  const angle = angleBetween(start, end);
  return {
    from,
    to,
    start,
    end,
    angle,
    altitude: 0.04 + 0.12 * (angle / Math.PI), // 먼 구간일수록 높이 뜬다
    duration: LEG_BASE_SECONDS + LEG_SECONDS_PER_RADIAN * angle,
    departure: 0
  };
}

/** 항공편의 구간 목록과 한 바퀴 주기를 만든다. */
export function createSchedule(flight) {
  const legs = flight.stops.map((city, index) => createLeg(city, flight.stops[(index + 1) % flight.stops.length]));
  let clock = 0;
  for (const leg of legs) {
    leg.departure = clock;
    clock += leg.duration + GROUND_SECONDS;
  }
  return { ...flight, legs, cycle: clock };
}

/** 구간 진행도 t(0~1) 위치. 지표면 위로 sin 곡선만큼 떠오른다. */
export function routePosition(leg, t) {
  const lift = 1 + leg.altitude * Math.sin(Math.PI * t);
  return slerp(leg.start, leg.end, leg.angle, t).map((value) => value * lift);
}

/**
 * 시각 time에서 항공편 상태.
 * flying: 구간 비행 경과(0~1), progress: 이착륙 감속을 적용한 위치, landed: 착륙 후 대기 경과(0~1).
 */
export function flightStatus(schedule, time) {
  const local = ((time + schedule.offset) % schedule.cycle + schedule.cycle) % schedule.cycle;
  const index = schedule.legs.findLastIndex((leg) => leg.departure <= local);
  const leg = schedule.legs[index];
  const elapsed = local - leg.departure;
  const flying = Math.min(1, elapsed / leg.duration);
  return {
    index,
    leg,
    flying,
    progress: 0.5 - 0.5 * Math.cos(Math.PI * flying),
    landed: Math.max(0, (elapsed - leg.duration) / GROUND_SECONDS)
  };
}

/** 항로 위 비행기 자세. forward는 진행 방향, side는 날개 방향, normal은 지구 바깥 방향이다. */
export function planePose(leg, progress) {
  const position = routePosition(leg, progress);
  const ahead = routePosition(leg, Math.min(1, progress + TANGENT_STEP));
  const behind = routePosition(leg, Math.max(0, progress - TANGENT_STEP));
  const normal = normalize(position);
  const side = normalize(cross(normal, subtract(ahead, behind)));
  return { position, forward: cross(side, normal), side, normal };
}
