import { FLOATS_PER_POINT } from '../travel-hero/geometry.js';
import { hexToRgb } from '../travel-hero/math.js';
import { FRAGMENT_SHADER_SOURCE, VERTEX_SHADER_SOURCE } from '../travel-hero/shaders.js';
import { createPointMesh, createProgram, getUniforms } from '../travel-hero/webgl.js';
import { HAND_HEIGHT, HIP_OFFSET, PERSON_STEP, SHOULDER, createBodyPoints, createLimbPoints } from './geometry.js';
import { FLOOR_Y, PEOPLE_COUNT, PERSON_HEIGHT, personPose, walkedDistance } from './ring.js';
import { HIP_HEIGHT, LEG_LENGTH, walkPose } from './walk.js';

/*
 * 한 프레임 그리기. 바닥 위 원을 따라 걷는 사람들을 화면 기준으로 똑바로 세워 그린다.
 * 원의 3D 위치는 여기서 직접 원근 투영해 화면 평면(z = 0)에 놓고, 홈 히어로의 점 셰이더로 찍는다.
 * 먼 사람부터 그려 가까운 사람이 위에 겹치며, 멀수록 작고 옅다.
 */

const UNIFORM_NAMES = [
  'uView', 'uPixelRatio', 'uCenter', 'uRadius', 'uRot', 'uOrigin', 'uAxes', 'uMouse', 'uHover', 'uRepel',
  'uEnter', 'uLeave', 'uTime', 'uVariant', 'uDot', 'uColorA', 'uColorB', 'uAlpha', 'uBack', 'uShade',
  'uTrail', 'uSafe', 'uSafeFloor', 'uCorner'
];

const CAMERA_DISTANCE = 4; // shaders.js와 같은 카메라 거리
const FAR_ALPHA = 0.5;
const LIMB_DOT_SCALE = 1.5;
const IDENTITY = new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);
const NO_TRAIL = new Float32Array(3);
const UP = [0, 1, 0];

const rgbPair = ([a, b]) => [hexToRgb(a), hexToRgb(b)];

// 홈 히어로 항공편·육지 색을 번갈아 입힌다
const PERSON_COLORS = [
  ['#f0327f', '#ff8a3d'], ['#6a4dff', '#2f9bff'], ['#f06a00', '#e3a800'], ['#3182f6', '#22b8a0']
].map(rgbPair);

const PERSON_LAYER = { alpha: 1, corner: 0.5, back: 1, shade: 0, safeFloor: 0.7 };

const add = (a, b, scale = 1) => [a[0] + b[0] * scale, a[1] + b[1] * scale, a[2] + b[2] * scale];

/** 3x3 열 우선 행렬과 벡터의 곱. */
const transform = (m, v) => [
  m[0] * v[0] + m[3] * v[1] + m[6] * v[2],
  m[1] * v[0] + m[4] * v[1] + m[7] * v[2],
  m[2] * v[0] + m[5] * v[1] + m[8] * v[2]
];

/** 바닥 좌표를 카메라 기준으로 돌려 원근 투영한다. scale은 그 지점의 원근 배율, depth는 앞쪽(+)·뒤쪽(-) 정도다. */
function project(view, point) {
  const [x, y, z] = transform(view, point);
  const scale = CAMERA_DISTANCE / (CAMERA_DISTANCE - z);
  return { x: x * scale, y: y * scale, scale, depth: z };
}

export function createBoardScene(gl) {
  const program = createProgram(gl, VERTEX_SHADER_SOURCE, FRAGMENT_SHADER_SOURCE);
  if (!program) return null;

  const u = getUniforms(gl, program, UNIFORM_NAMES);
  const bodyMesh = createPointMesh(gl, createBodyPoints(), FLOATS_PER_POINT);
  const limbMesh = createPointMesh(gl, createLimbPoints(), FLOATS_PER_POINT);

  const origin = new Float32Array(3);
  const axes = new Float32Array(9);

  gl.useProgram(program);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.clearColor(0, 0, 0, 0);

  function draw(target, person, enter, dotScale = 1) {
    gl.uniform3fv(u.uOrigin, origin);
    gl.uniformMatrix3fv(u.uAxes, false, axes);
    gl.uniform1f(u.uEnter, enter);
    gl.uniform1f(u.uAlpha, PERSON_LAYER.alpha * person.alpha);
    gl.uniform1f(u.uDot, person.dot * dotScale);
    gl.uniform1f(u.uVariant, person.variant);
    gl.uniform3fv(u.uColorA, person.colors[0]);
    gl.uniform3fv(u.uColorB, person.colors[1]);
    target.draw();
  }

  /** 화면 좌표 선분 a→b를 팔다리 점선으로 그린다. 한 줄이라 몸보다 굵은 점으로 찍는다. */
  function drawLimb(a, b, person, enter) {
    origin.set([a[0], a[1], 0]);
    axes.set([b[0] - a[0], b[1] - a[1], 0, 0, 0, 0, 0, 0, 0]);
    draw(limbMesh, person, enter, LIMB_DOT_SCALE);
  }

  /** 한 사람의 화면 배치: 몸 원점, 어깨·엉덩이, 양손·양발. */
  function layoutPerson(index, view, angle, stride, dot) {
    const { feet, tangent } = personPose(index, angle);
    const base = project(view, add(feet, UP, -stride.drop * PERSON_HEIGHT));
    const unit = PERSON_HEIGHT * base.scale;
    const at = (x, y) => [base.x + x * unit, base.y + y * unit];

    // 이웃과 맞잡는 손은 두 사람 발 사이 한가운데 위에 있다
    const handTo = (other) => {
      const next = personPose(other, angle).feet;
      const middle = [(feet[0] + next[0]) / 2, FLOOR_Y + HAND_HEIGHT * PERSON_HEIGHT, (feet[2] + next[2]) / 2];
      const point = project(view, middle);
      return [point.x, point.y];
    };
    const hands = [handTo((index + PEOPLE_COUNT - 1) % PEOPLE_COUNT), handTo((index + 1) % PEOPLE_COUNT)];
    hands.sort((a, b) => a[0] - b[0]); // 화면 왼쪽 손은 왼쪽 어깨에

    // 다리는 걷는 방향(접선)으로 앞뒤로 흔들린다
    const hip = add(feet, UP, (HIP_HEIGHT - stride.drop) * PERSON_HEIGHT);
    const hipPoint = project(view, hip);
    const legLength = LEG_LENGTH * PERSON_HEIGHT;
    const legs = [-1, 1].map((side) => {
      const swing = side * stride.swing;
      const footPoint = project(view, add(add(hip, tangent, Math.sin(swing) * legLength), UP, -Math.cos(swing) * legLength));
      const offset = side * HIP_OFFSET * unit;
      return [[hipPoint.x + offset, hipPoint.y], [footPoint.x + offset, footPoint.y]];
    });

    return {
      base,
      unit,
      alpha: FAR_ALPHA + (1 - FAR_ALPHA) * Math.min(1, Math.max(0, (base.depth + 1) / 2)),
      dot: dot * base.scale,
      colors: PERSON_COLORS[index % PERSON_COLORS.length],
      variant: index * 0.173,
      arms: [[at(-SHOULDER[0], SHOULDER[1]), hands[0]], [at(SHOULDER[0], SHOULDER[1]), hands[1]]],
      legs
    };
  }

  /**
   * frame: 캔버스 크기(width, height, pixelRatio), 원 위치(centerX, centerY, radius), 카메라 회전(view),
   * 원 회전각(ringAngle), 커서(mouseX, mouseY, hover), 스크롤 이탈(leave), 시각(time), 등장(enter),
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
    gl.uniformMatrix3fv(u.uRot, false, IDENTITY);
    gl.uniform2f(u.uMouse, frame.mouseX, frame.mouseY);
    gl.uniform1f(u.uHover, frame.hover);
    gl.uniform1f(u.uRepel, Math.max(110, radius * 0.3));
    gl.uniform1f(u.uLeave, frame.leave);
    gl.uniform1f(u.uTime, frame.time);
    gl.uniform4fv(u.uSafe, frame.safe);
    gl.uniform3fv(u.uTrail, NO_TRAIL);
    gl.uniform1f(u.uCorner, PERSON_LAYER.corner);
    gl.uniform1f(u.uBack, PERSON_LAYER.back);
    gl.uniform1f(u.uShade, PERSON_LAYER.shade);
    gl.uniform1f(u.uSafeFloor, PERSON_LAYER.safeFloor);

    const stride = walkPose(walkedDistance(frame.ringAngle));
    // 홈 지구본처럼 점 사이가 살짝 비치도록 간격보다 작게 찍는다
    const dot = Math.max(1.4, radius * PERSON_HEIGHT * PERSON_STEP * 0.8);
    const people = Array.from({ length: PEOPLE_COUNT }, (_, index) =>
      layoutPerson(index, frame.view, frame.ringAngle, stride, dot));
    people.sort((a, b) => a.base.depth - b.base.depth);

    for (const person of people) {
      for (const [a, b] of person.legs) drawLimb(a, b, person, frame.enter);
      for (const [a, b] of person.arms) drawLimb(a, b, person, frame.enter);
      origin.set([person.base.x, person.base.y, 0]);
      axes.set([person.unit, 0, 0, 0, person.unit, 0, 0, 0, 0]);
      draw(bodyMesh, person, frame.enter);
    }
  }

  return { render };
}
