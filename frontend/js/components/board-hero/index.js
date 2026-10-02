import { clamp, rotationMatrix } from '../travel-hero/math.js';
import { createBoardScene } from './scene.js';

/*
 * 게시판 히어로 캔버스.
 * - 기본 상태: 점으로 된 사람들이 손잡고 바닥 위 원을 따라 걷는다. 화면에서 보면 사람은 똑바로 서 있고,
 *   앞쪽(아래) 사람과 뒤쪽(위) 사람이 서로 반대 방향으로 지나가며 문구를 둘러싼다.
 * - 커서: 반경 안의 점이 밀려나고, 원이 커서 쪽으로 기울며, 좌우로 움직이면 그 방향으로 빨리 걷는다.
 * - 등장: 흩어진 점이 위쪽부터 모여 사람이 된다.
 * - 스크롤: 히어로를 벗어날수록 점이 바깥으로 흩어지며 사라진다.
 */

const MAX_PIXEL_RATIO = 2;
const RING_SPEED = (Math.PI * 2) / 60; // 60초에 한 바퀴
const CAMERA_PITCH = 0.5; // 위에서 내려다보는 각도
const ENTER_SECONDS = 2.2;
const POINTER_SPIN = 1.2;
const SPIN_DAMPING = 2.2;

export function initializeBoardHero() {
  const canvas = document.querySelector('.board-hero__canvas');
  const content = document.querySelector('.board-hero__content');
  if (!canvas || !content) return;

  const gl = canvas.getContext('webgl2', {
    alpha: true,
    antialias: false,
    depth: false,
    premultipliedAlpha: true,
    powerPreference: 'low-power'
  });
  if (!gl) return;

  const scene = createBoardScene(gl);
  if (!scene) return;

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const layout = { width: 1, height: 1, pixelRatio: 1, centerX: 0, centerY: 0, radius: 1, safe: new Float32Array(4) };

  // 원은 문구 중앙을 둘러싸고, 문구를 감싸는 타원 안의 점은 옅게 그린다
  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    const box = content.getBoundingClientRect();
    layout.width = Math.max(1, Math.round(rect.width));
    layout.height = Math.max(1, Math.round(rect.height));
    layout.pixelRatio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
    layout.centerX = box.left - rect.left + box.width / 2;
    layout.centerY = box.top - rect.top + box.height / 2;
    layout.radius = Math.max(1, Math.min(layout.width * 0.44, (layout.height - 40) * 0.62, 380));
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

    // 커서를 좌우로 쓸면 앞줄 사람들이 그 방향으로 빨리 걷다가 서서히 원래 걸음으로 돌아온다
    if (isInside) spin.velocity += (pointer.deltaX / layout.width) * POINTER_SPIN;
    pointer.deltaX = 0;
    spin.velocity *= Math.exp(-deltaSeconds * SPIN_DAMPING);
    spin.angle += spin.velocity * deltaSeconds;

    scene.render({
      ...layout,
      view: rotationMatrix(smooth.parallaxX * 0.3, CAMERA_PITCH - smooth.parallaxY * 0.2, 0),
      ringAngle: RING_SPEED * elapsedSeconds + spin.angle,
      mouseX: smooth.x,
      mouseY: smooth.y,
      hover: smooth.hover,
      leave: clamp(-rect.top / (rect.height * 0.8), 0, 1),
      time: elapsedSeconds,
      enter: prefersReducedMotion ? 1 : clamp(elapsedSeconds / ENTER_SECONDS, 0, 1)
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
