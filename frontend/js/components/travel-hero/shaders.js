/*
 * 지구본·항로·도시·비행기를 모두 그리는 단일 점 셰이더.
 * 각 점 구름은 world = uOrigin + uAxes * aPos 로 지구 좌표에 놓인 뒤 지구 회전(uRot)을 함께 따른다.
 * - 지구 뒤편 점은 uBack만큼 비쳐 보인다.
 * - 커서 근처 점은 커서 반대쪽으로 밀려나며 커지고 진해진다.
 * - 등장 시 지구 중심에서 터져 나와 위쪽부터 제자리로 모이고, 스크롤로 벗어나면 흩어진다.
 * - 문구 영역(uSafe 타원) 안의 점은 uSafeFloor까지 옅어져 글자를 가리지 않는다.
 */

export const VERTEX_SHADER_SOURCE = `#version 300 es
layout(location = 0) in vec3 aPos;
layout(location = 1) in vec4 aSeed;

uniform vec2 uView;
uniform float uPixelRatio;
uniform vec2 uCenter;
uniform float uRadius;
uniform mat3 uRot;
uniform vec3 uOrigin;
uniform mat3 uAxes;
uniform vec2 uMouse;
uniform float uHover;
uniform float uRepel;
uniform float uEnter;
uniform float uLeave;
uniform float uTime;
uniform float uVariant;
uniform float uDot;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform float uAlpha;
uniform float uBack;
uniform float uShade;
uniform vec3 uTrail; // x: 비행 진행도, y: 밝은 꼬리 길이(0이면 항로가 아님), z: 앞으로 갈 항로 밝기
uniform vec4 uSafe;  // xy: 문구 중심, zw: 타원 반지름
uniform float uSafeFloor;

out vec3 vColor;
out float vAlpha;

const float CAMERA_DISTANCE = 4.0;

void main() {
  float h1 = fract(aSeed.x + uVariant * 0.618);
  float h2 = fract(aSeed.y + uVariant * 0.414);
  float h3 = aSeed.z;
  bool isRoute = uTrail.y > 0.0;
  float weight = isRoute ? 1.0 : aSeed.w;

  vec3 p = uRot * (uOrigin + uAxes * aPos);
  float persp = CAMERA_DISTANCE / (CAMERA_DISTANCE - p.z);
  vec2 home = uCenter + vec2(p.x, -p.y) * persp * uRadius;

  // 지구 뒤에 가려진 점은 반투명하게, 앞면은 가장자리로 갈수록 살짝 어둡게
  bool behind = p.z < 0.0 && dot(p.xy, p.xy) < 1.0;
  float facing = behind ? uBack : mix(1.0 - uShade, 1.0, clamp(p.z, 0.0, 1.0));

  // 커서 근접 → 점이 커서 반대쪽으로 밀려나며 부풀어 오른다
  vec2 away = home - uMouse;
  float dist = length(away);
  float e = clamp(1.0 - dist / uRepel, 0.0, 1.0);
  float near = e * e * (3.0 - 2.0 * e) * uHover * (behind ? 0.3 : 1.0);
  float th = h2 * 6.2831853 + uTime * (0.4 + 0.6 * h3);
  vec2 dir = vec2(cos(th), sin(th));
  vec2 pos = home
    + away / max(dist, 1.0) * near * uRadius * 0.09
    + dir * near * uRadius * 0.02 * h1;

  // 등장: 지구 중심에서 터져 나와 위쪽부터 자리를 잡는다
  float hy = clamp(0.5 + 0.5 * aPos.y, 0.0, 1.0);
  float start = (1.0 - hy) * 0.35 + h3 * 0.12;
  float arrive = smoothstep(start, start + 0.5, uEnter);
  vec2 burst = uCenter + dir * uRadius * 1.1 * (0.3 + 0.7 * h1) * smoothstep(0.0, 0.35, uEnter);
  pos = mix(burst, pos, arrive);

  // 스크롤 이탈: 화면 중앙 반대쪽으로 흩어진다
  pos += (dir * uRadius * 0.9 + (pos - uView * 0.5) * 0.35) * uLeave * (0.4 + 0.6 * h1);

  vec2 clip = pos / uView * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
  gl_PointSize = uDot * uPixelRatio * persp * mix(0.8, 1.0, weight) * (1.0 + 0.45 * near) * (behind ? 0.75 : 1.0);

  // 표면을 따라 흐르는 2색 그라디언트
  float g = fract(aPos.y * 0.6 + aPos.x * 0.25 + uTime * 0.06 + uVariant);
  vColor = mix(uColorA, uColorB, smoothstep(0.0, 1.0, abs(g * 2.0 - 1.0)));

  // 항로: 비행기가 지나온 부분은 밝은 꼬리로, 남은 부분은 옅은 점선으로
  float trail = 1.0;
  if (isRoute) {
    float passed = uTrail.x - aSeed.w;
    trail = passed < 0.0 ? uTrail.z : mix(0.35, 1.0, 1.0 - clamp(passed / uTrail.y, 0.0, 1.0));
  }

  // 바다 점은 은은하게 반짝여 정지 상태에서도 살아 있어 보인다
  float twinkle = weight < 0.5 ? 0.8 + 0.2 * sin(uTime * 2.2 + h1 * 40.0) : 1.0;
  float safe = mix(uSafeFloor, 1.0, smoothstep(0.7, 1.15, length((home - uSafe.xy) / uSafe.zw)));

  vAlpha = mix(0.32, 1.0, weight) * uAlpha * facing * trail * twinkle * safe
    * (1.0 + 0.4 * near) * arrive * (1.0 - uLeave);
}
`;

export const FRAGMENT_SHADER_SOURCE = `#version 300 es
precision mediump float;

uniform float uCorner;

in vec3 vColor;
in float vAlpha;

out vec4 outColor;

void main() {
  // 둥근 정사각형 도트 (uCorner 0 = 픽셀, 0.5 = 원)
  vec2 q = abs(gl_PointCoord - 0.5);
  float d = length(max(q - vec2(0.5 - uCorner), 0.0)) - uCorner;
  float a = (1.0 - smoothstep(-0.06, 0.02, d)) * min(vAlpha, 1.0);
  if (a < 0.003) discard;
  outColor = vec4(vColor * a, a);
}
`;
