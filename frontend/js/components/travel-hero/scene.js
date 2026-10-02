import {
  FLOATS_PER_POINT,
  GLOBE_STEP,
  PLANE_STEP,
  createGlobePoints,
  createPlanePoints,
  createRingPoints,
  createRoutePoints
} from './geometry.js';
import { cross, hexToRgb, lonLatToVector, normalize, smoothstep } from './math.js';
import { CITIES, FLIGHTS, createSchedule, flightStatus, planePose } from './routes.js';
import { FRAGMENT_SHADER_SOURCE, VERTEX_SHADER_SOURCE } from './shaders.js';
import { createPointMesh, createProgram, getUniforms } from './webgl.js';

/*
 * 한 프레임 그리기: 바다 → 육지 → 항로 → 도시 → 비행기 순으로 겹친다.
 * 크기 단위는 지구 반지름 1 기준이다.
 */

const UNIFORM_NAMES = [
  'uView', 'uPixelRatio', 'uCenter', 'uRadius', 'uRot', 'uOrigin', 'uAxes', 'uMouse', 'uHover', 'uRepel',
  'uEnter', 'uLeave', 'uTime', 'uVariant', 'uDot', 'uColorA', 'uColorB', 'uAlpha', 'uBack', 'uShade',
  'uTrail', 'uSafe', 'uSafeFloor', 'uCorner'
];

const PLANE_SIZE = 0.17;
const CITY_SIZE = 0.02;
const RIPPLE_GROWTH = 2.8;
const TRAIL_LENGTH = 0.4;
const ROUTE_FUTURE_ALPHA = 0.2;
const DEPARTURE_RIPPLE = 0.25; // 비행 진행도 중 이륙 파문이 퍼지는 구간

const ORIGIN = new Float32Array(3);
const IDENTITY = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);
const NO_TRAIL = new Float32Array(3);

const rgbPair = ([a, b]) => [hexToRgb(a), hexToRgb(b)];

const LAYERS = {
  ocean: { colors: rgbPair(['#9db4d6', '#c6d5ec']), alpha: 0.6, corner: 0.5, back: 0.3, shade: 0.4, safeFloor: 0.35 },
  land: { colors: rgbPair(['#3182f6', '#22b8a0']), alpha: 0.92, corner: 0.5, back: 0.14, shade: 0.5, safeFloor: 0.28 },
  route: { alpha: 0.95, corner: 0.5, back: 0.12, shade: 0.2, safeFloor: 0.5 },
  city: { colors: rgbPair(['#191f28', '#3182f6']), alpha: 1, corner: 0.5, back: 0.12, shade: 0.2, safeFloor: 0.5 },
  plane: { alpha: 1, corner: 0.15, back: 0.18, shade: 0.15, safeFloor: 0.7 }
};

/** 3x3 열 우선 행렬에 세 축을 scale배 해서 담는다. */
function writeAxes(target, x, y, z, scale) {
  target.set([x[0] * scale, x[1] * scale, x[2] * scale, y[0] * scale, y[1] * scale, y[2] * scale,
    z[0] * scale, z[1] * scale, z[2] * scale]);
  return target;
}

/** 도시 지점의 접평면 기준(동·북·바깥). */
function cityBasis(name) {
  const normal = lonLatToVector(...CITIES[name]);
  const east = normalize(cross([0, 1, 0], normal));
  return { origin: new Float32Array(normal), east, north: cross(normal, east), normal };
}

export function createTravelScene(gl) {
  const program = createProgram(gl, VERTEX_SHADER_SOURCE, FRAGMENT_SHADER_SOURCE);
  if (!program) return null;

  const u = getUniforms(gl, program, UNIFORM_NAMES);
  const mesh = (data) => createPointMesh(gl, data, FLOATS_PER_POINT);
  const globe = createGlobePoints();
  const oceanMesh = mesh(globe.ocean);
  const landMesh = mesh(globe.land);
  const planeMesh = mesh(createPlanePoints());
  const ringMesh = mesh(createRingPoints());

  const flights = FLIGHTS.map((flight) => {
    const schedule = createSchedule(flight);
    return { schedule, colors: rgbPair(flight.colors), routeMeshes: schedule.legs.map((leg) => mesh(createRoutePoints(leg))) };
  });
  const cities = new Map(
    [...new Set(FLIGHTS.flatMap((flight) => flight.stops))].map((name) => [name, cityBasis(name)])
  );

  const axes = new Float32Array(9);
  const trail = new Float32Array(3);

  gl.useProgram(program);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.clearColor(0, 0, 0, 0);

  function drawLayer(target, layer, options) {
    const colors = options.colors ?? layer.colors;
    gl.uniform3fv(u.uOrigin, options.origin ?? ORIGIN);
    gl.uniformMatrix3fv(u.uAxes, false, options.axes ?? IDENTITY);
    gl.uniform1f(u.uEnter, options.enter);
    gl.uniform1f(u.uAlpha, layer.alpha * (options.alpha ?? 1));
    gl.uniform1f(u.uDot, options.dot);
    gl.uniform1f(u.uVariant, options.variant ?? 0);
    gl.uniform3fv(u.uTrail, options.trail ?? NO_TRAIL);
    gl.uniform3fv(u.uColorA, colors[0]);
    gl.uniform3fv(u.uColorB, colors[1]);
    gl.uniform1f(u.uCorner, layer.corner);
    gl.uniform1f(u.uBack, layer.back);
    gl.uniform1f(u.uShade, layer.shade);
    gl.uniform1f(u.uSafeFloor, layer.safeFloor);
    target.draw();
  }

  function drawRing(name, scale, alpha, enter) {
    const city = cities.get(name);
    drawLayer(ringMesh, LAYERS.city, {
      origin: city.origin,
      axes: writeAxes(axes, city.east, city.north, city.normal, scale),
      enter,
      alpha,
      dot: 2
    });
  }

  /**
   * frame: 캔버스 크기(width, height, pixelRatio), 지구 위치(centerX, centerY, radius), 회전 행렬(rotation),
   * 커서(mouseX, mouseY, hover), 스크롤 이탈(leave), 시각(time, flightTime), 등장(globeEnter, flightEnter),
   * 문구 영역(safe: [x, y, rx, ry]).
   */
  function render(frame) {
    const { radius } = frame;
    gl.useProgram(program);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(u.uView, frame.width, frame.height);
    gl.uniform1f(u.uPixelRatio, frame.pixelRatio);
    gl.uniform2f(u.uCenter, frame.centerX, frame.centerY);
    gl.uniform1f(u.uRadius, radius);
    gl.uniformMatrix3fv(u.uRot, false, frame.rotation);
    gl.uniform2f(u.uMouse, frame.mouseX, frame.mouseY);
    gl.uniform1f(u.uHover, frame.hover);
    gl.uniform1f(u.uRepel, Math.max(110, radius * 0.5));
    gl.uniform1f(u.uLeave, frame.leave);
    gl.uniform1f(u.uTime, frame.time);
    gl.uniform4fv(u.uSafe, frame.safe);

    const globeDot = Math.max(2, radius * GLOBE_STEP * 0.42);
    drawLayer(oceanMesh, LAYERS.ocean, { enter: frame.globeEnter, dot: globeDot });
    drawLayer(landMesh, LAYERS.land, { enter: frame.globeEnter, dot: globeDot });

    const statuses = flights.map(({ schedule }) => flightStatus(schedule, frame.flightTime));
    const enter = frame.flightEnter;

    // 항로: 이륙과 함께 나타나고 착륙 후 대기하는 동안 사라진다
    statuses.forEach((status, index) => {
      const flight = flights[index];
      trail.set([status.progress, TRAIL_LENGTH, ROUTE_FUTURE_ALPHA]);
      drawLayer(flight.routeMeshes[status.index], LAYERS.route, {
        colors: flight.colors,
        enter,
        alpha: smoothstep(0, 0.08, status.flying) * (1 - status.landed),
        dot: Math.max(1.8, radius * 0.0085),
        variant: index * 0.173,
        trail
      });
    });

    // 도시 표식과 이착륙 파문
    for (const name of cities.keys()) drawRing(name, CITY_SIZE, 1, enter);
    for (const { leg, flying, landed } of statuses) {
      if (flying < DEPARTURE_RIPPLE) {
        const phase = flying / DEPARTURE_RIPPLE;
        drawRing(leg.from, CITY_SIZE * (1 + RIPPLE_GROWTH * phase), (1 - phase) ** 2 * 0.8, enter);
      }
      if (landed > 0) drawRing(leg.to, CITY_SIZE * (1 + RIPPLE_GROWTH * landed), (1 - landed) ** 2 * 0.8, enter);
    }

    // 비행기: 이륙하며 커지고 착륙하며 작아진다
    statuses.forEach((status, index) => {
      if (status.flying >= 1) return;
      const pose = planePose(status.leg, status.progress);
      const size = PLANE_SIZE * (0.6 + 0.4 * Math.sin(Math.PI * status.progress));
      drawLayer(planeMesh, LAYERS.plane, {
        colors: flights[index].colors,
        origin: new Float32Array(pose.position),
        axes: writeAxes(axes, pose.forward, pose.side, pose.normal, size),
        enter,
        alpha: smoothstep(0, 0.05, status.flying) * (1 - smoothstep(0.95, 1, status.flying)),
        dot: Math.max(1.4, radius * size * PLANE_STEP * 1.15),
        variant: index * 0.173
      });
    });
  }

  return { render };
}
