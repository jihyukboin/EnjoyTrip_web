import { clamp, radians, rotationMatrix } from './math.js';
import { createTravelScene } from './scene.js';

/*
 * 여행 히어로 캔버스.
 * - 기본 상태: 점으로 된 지구본이 천천히 자전하고, 비행기 세 대가 도시 사이 대원 항로를 날며 꼬리를 남긴다.
 * - 커서: 반경 안의 점이 밀려나고, 지구본이 커서 쪽으로 기울며, 좌우로 움직이면 그 방향으로 굴러간다.
 * - 등장: 지구 중심에서 점이 터져 나와 위쪽부터 모이고, 뒤이어 항로와 비행기가 나타난다.
 * - 스크롤: 히어로를 벗어날수록 점이 바깥으로 흩어지며 사라진다.
 */

const MAX_PIXEL_RATIO = 2;
const FACE_LONGITUDE = 127; // 처음에는 한반도가 정면을 향한다
const SPIN_SPEED = (Math.PI * 2) / 90; // 90초에 한 바퀴
const BASE_TILT = 0.4;
const ROLL = -0.12;
const GLOBE_ENTER_SECONDS = 2.2;
const FLIGHT_DELAY_SECONDS = 1.3;
const FLIGHT_ENTER_SECONDS = 1.2;
const STATIC_FLIGHT_TIME = 3.4; // 움직임 줄이기 설정에서 비행기가 항로 중간에 보이는 시각
const POINTER_SPIN = 1.8;
const SPIN_DAMPING = 2.2;

export function initializeTravelHero() {
  const canvas = document.querySelector('.travel-hero__canvas');
  const content = document.querySelector('.travel-hero__content');
  if (!canvas || !content) return;

  const gl = canvas.getContext('webgl2', {
    alpha: true,
    antialias: false,
    depth: false,
    premultipliedAlpha: true,
    powerPreference: 'low-power'
  });
  if (!gl) return;

  const scene = createTravelScene(gl);
  if (!scene) return;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const layout = { width: 1, height: 1, pixelRatio: 1, centerX: 0, centerY: 0, radius: 1, safe: new Float32Array(4) };

  // 지구본은 문구 중앙에 두고, 문구를 감싸는 타원 안의 점은 옅게 그린다
  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    const box = content.getBoundingClientRect();
    layout.width = Math.max(1, Math.round(rect.width));
    layout.height = Math.max(1, Math.round(rect.height));
    layout.pixelRatio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
    layout.centerX = box.left - rect.left + box.width / 2;
    layout.centerY = box.top - rect.top + box.height / 2;
    layout.radius = Math.max(1, Math.min(layout.width * 0.46, (layout.height - 40) * 0.43, 280));
    layout.safe.set([layout.centerX, layout.centerY, box.width * 0.62 + 16, box.height * 0.62 + 16]);

    const drawWidth = Math.round(layout.width * layout.pixelRatio);
    const drawHeight = Math.round(layout.height * layout.pixelRatio);
    if (canvas.width !== drawWidth || canvas.height !== drawHeight) {
      canvas.width = drawWidth;
      canvas.height = drawHeight;
    }
    gl.viewport(0, 0, drawWidth, drawHeight);
  };

  // 포인터는 원시 좌표만 받아 두고, 프레임마다 부드럽게 따라간다
  const pointer = { clientX: -1e5, clientY: -1e5, inside: false, deltaX: 0 };
  const smooth = { x: -1e5, y: -1e5, hover: 0, parallaxX: 0, parallaxY: 0 };
  const spin = { angle: 0, velocity: 0 };

  const handlePointerMove = (event) => {
    if (pointer.inside) pointer.deltaX += event.clientX - pointer.clientX;
    pointer.clientX = event.clientX;
    pointer.clientY = event.clientY;
    pointer.inside = true;
  };
  const handlePointerLeave = () => {
    pointer.inside = false;
  };

  const draw = (elapsedSeconds, deltaSeconds) => {
    const rect = canvas.getBoundingClientRect();
    const localX = pointer.clientX - rect.left;
    const localY = pointer.clientY - rect.top;
    const isInside =
      pointer.inside && localX >= 0 && localY >= 0 && localX <= rect.width && localY <= rect.height;

    const follow = 1 - Math.exp(-deltaSeconds * 10);
    if (smooth.x < -1e4 && isInside) {
      smooth.x = localX;
      smooth.y = localY;
    }
    if (isInside) {
      smooth.x += (localX - smooth.x) * follow;
      smooth.y += (localY - smooth.y) * follow;
    }
    smooth.hover += ((isInside ? 1 : 0) - smooth.hover) * (1 - Math.exp(-deltaSeconds * 4));
    const targetParallaxX = isInside ? localX / layout.width - 0.5 : 0;
    const targetParallaxY = isInside ? localY / layout.height - 0.5 : 0;
    smooth.parallaxX += (targetParallaxX - smooth.parallaxX) * follow * 0.3;
    smooth.parallaxY += (targetParallaxY - smooth.parallaxY) * follow * 0.3;

    // 커서를 좌우로 쓸면 지구본이 그 방향으로 굴러가다 서서히 멈춘다
    if (isInside) spin.velocity += (pointer.deltaX / layout.width) * POINTER_SPIN;
    pointer.deltaX = 0;
    spin.velocity *= Math.exp(-deltaSeconds * SPIN_DAMPING);
    spin.angle += spin.velocity * deltaSeconds;

    const yaw = radians(-FACE_LONGITUDE) + SPIN_SPEED * elapsedSeconds + spin.angle + smooth.parallaxX * 0.45;
    const tilt = BASE_TILT + 0.04 * Math.sin(elapsedSeconds * 0.35) - smooth.parallaxY * 0.3;
    const flightSeconds = elapsedSeconds - FLIGHT_DELAY_SECONDS;

    scene.render({
      ...layout,
      rotation: rotationMatrix(yaw, tilt, ROLL),
      mouseX: smooth.x,
      mouseY: smooth.y,
      hover: smooth.hover,
      leave: clamp(-rect.top / (rect.height * 0.8), 0, 1),
      time: elapsedSeconds,
      globeEnter: prefersReducedMotion ? 1 : clamp((elapsedSeconds - 0.15) / GLOBE_ENTER_SECONDS, 0, 1),
      flightEnter: prefersReducedMotion ? 1 : clamp(flightSeconds / FLIGHT_ENTER_SECONDS, 0, 1),
      flightTime: prefersReducedMotion ? STATIC_FLIGHT_TIME : Math.max(0, flightSeconds)
    });
  };

  resize();

  const resizeObserver = new ResizeObserver(() => {
    resize();
    if (prefersReducedMotion) draw(0, 0);
  });
  resizeObserver.observe(canvas);
  resizeObserver.observe(content);

  if (prefersReducedMotion) {
    draw(0, 0);
    return;
  }

  window.addEventListener('pointermove', handlePointerMove, { passive: true });
  document.documentElement.addEventListener('pointerleave', handlePointerLeave);

  let frameId = 0;
  let elapsedSeconds = 0;
  let lastTimestamp = 0;
  let isOnScreen = true;

  const renderFrame = (timestamp) => {
    const deltaSeconds = lastTimestamp ? Math.min(0.05, (timestamp - lastTimestamp) / 1000) : 1 / 60;
    lastTimestamp = timestamp;
    elapsedSeconds += deltaSeconds;
    draw(elapsedSeconds, deltaSeconds);
    frameId = window.requestAnimationFrame(renderFrame);
  };

  const play = () => {
    if (frameId || !isOnScreen || document.hidden) return;
    lastTimestamp = 0;
    frameId = window.requestAnimationFrame(renderFrame);
  };

  const pause = () => {
    if (!frameId) return;
    window.cancelAnimationFrame(frameId);
    frameId = 0;
  };

  new IntersectionObserver((entries) => {
    isOnScreen = entries.some((entry) => entry.isIntersecting);
    if (isOnScreen) play();
    else pause();
  }).observe(canvas);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pause();
    else play();
  });

  play();
}
