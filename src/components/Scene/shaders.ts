/**
 * Shared GLSL. All custom materials take their lighting from the `env`
 * uniforms (src/world/environment.ts) so one update re-lights the world.
 */
import { env } from "@/world/environment";

export const envUniforms = () => ({
  uSunDir: env.uSunDir,
  uSunColor: env.uSunColor,
  uSunIntensity: env.uSunIntensity,
  uSkyTop: env.uSkyTop,
  uSkyHorizon: env.uSkyHorizon,
  uHemiSky: env.uHemiSky,
  uHemiGround: env.uHemiGround,
  uHemi: env.uHemi,
  uFogColor: env.uFogColor,
  uFogDensity: env.uFogDensity,
  uNight: env.uNight,
  uStars: env.uStars,
  uCloudColor: env.uCloudColor,
  uTime: env.uTime,
  uCarPos: env.uCarPos,
  uCarDir: env.uCarDir,
  uHeadlights: env.uHeadlights,
  uCity: env.uCity,
});

export const common = /* glsl */ `
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform float uSunIntensity;
uniform vec3 uSkyTop;
uniform vec3 uSkyHorizon;
uniform vec3 uHemiSky;
uniform vec3 uHemiGround;
uniform float uHemi;
uniform vec3 uFogColor;
uniform float uFogDensity;
uniform float uNight;
uniform float uStars;
uniform vec3 uCloudColor;
uniform float uTime;
uniform vec3 uCarPos;
uniform vec3 uCarDir;
uniform float uHeadlights;
uniform float uCity;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x),
             mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float a = 0.5;
  float s = 0.0;
  for (int i = 0; i < 4; i++) { s += a * vnoise(p); p *= 2.03; a *= 0.5; }
  return s;
}
vec3 ambientLight(vec3 n) {
  return mix(uHemiGround, uHemiSky, n.y * 0.5 + 0.5) * uHemi;
}
vec3 sunLight(vec3 n) {
  return uSunColor * uSunIntensity * max(dot(n, uSunDir), 0.0);
}
float headlight(vec3 w) {
  vec3 rel = w - uCarPos;
  float f = dot(rel.xz, uCarDir.xz);
  float sd = dot(rel.xz, vec2(-uCarDir.z, uCarDir.x));
  float cone = smoothstep(2.0, 14.0, f) * exp(-f * 0.028) * exp(-pow(sd / (0.3 * f + 1.6), 2.0));
  return cone * uHeadlights;
}
vec3 applyFog(vec3 col, float dist) {
  float f = 1.0 - exp(-uFogDensity * uFogDensity * dist * dist);
  return mix(col, uFogColor, clamp(f, 0.0, 1.0));
}
`;

export const outputChunk = /* glsl */ `
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
`;

// --- road ribbon -------------------------------------------------------------

export const roadVertex = /* glsl */ `
attribute float aLat;
attribute float aDist;
varying float vLat;
varying float vDist;
varying vec3 vWorld;
void main() {
  vLat = aLat;
  vDist = aDist;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

export const roadFragment = /* glsl */ `
${common}
uniform float uLen;
uniform float uPlainStart;
uniform float uPlainEnd;
uniform float uHalfW;
uniform float uLampStart;
uniform float uLampEnd;
uniform float uLampSpacing;
uniform float uLampHeadLat;
uniform float uStopLine;
uniform float uFade;
varying float vLat;
varying float vDist;
varying vec3 vWorld;

void main() {
  float lat = vLat;
  float d = vDist;
  float alat = abs(lat);
  vec2 wp = vWorld.xz;

  // Asphalt with aggregate noise and worn wheel tracks.
  float n = fbm(wp * 0.35) * 0.6 + vnoise(wp * 6.0) * 0.4;
  vec3 asphalt = mix(vec3(0.03, 0.032, 0.036), vec3(0.052, 0.054, 0.06), n);
  float tracks = exp(-pow((abs(alat - 2.0) - 0.85) / 0.32, 2.0));
  asphalt *= 1.0 - 0.22 * tracks;
  asphalt += vec3(0.01) * smoothstep(0.62, 0.9, vnoise(wp * 0.8 + 7.0)); // patch repairs

  vec3 gravel = mix(vec3(0.055, 0.054, 0.05), vec3(0.09, 0.087, 0.08), vnoise(wp * 3.0));
  float shoulder = smoothstep(uHalfW, uHalfW + 0.08, alat);
  vec3 albedo = mix(asphalt, gravel, shoulder);

  // Markings.
  float aa = fwidth(lat) * 1.2 + 0.005;
  float markOn = step(uPlainStart, d) * step(d, uLen - uPlainEnd);
  float dash = step(mod(d, 9.0), 3.2);
  float centre = (1.0 - smoothstep(0.08 - aa, 0.08 + aa, alat)) * dash;
  float edgeL = smoothstep(uHalfW - 0.42 - aa, uHalfW - 0.42 + aa, alat) * (1.0 - smoothstep(uHalfW - 0.26 - aa, uHalfW - 0.26 + aa, alat));
  float paint = max(centre, edgeL) * markOn;
  // Stop line across our (left) lane.
  if (uStopLine > 0.0) {
    float sl = step(uStopLine - 0.6, d) * step(d, uStopLine) * step(lat, -0.1) * step(-uHalfW + 0.3, lat);
    paint = max(paint, sl);
  }
  paint *= 0.75 + 0.25 * vnoise(wp * 9.0); // worn paint
  albedo = mix(albedo, vec3(0.62, 0.62, 0.6), paint);

  vec3 N = vec3(0.0, 1.0, 0.0);
  vec3 col = albedo * (ambientLight(N) + sunLight(N));

  // Sun sheen on the asphalt (grazing light).
  vec3 V = normalize(cameraPosition - vWorld);
  vec3 H = normalize(V + uSunDir);
  float spec = pow(max(dot(N, H), 0.0), 60.0) * (1.0 - shoulder);
  col += uSunColor * uSunIntensity * spec * 0.05;

  // Street lamp pools (lamps alternate sides every uLampSpacing metres).
  float k = floor((d - uLampStart) / uLampSpacing + 0.5);
  float ld = uLampStart + k * uLampSpacing;
  if (ld >= uLampStart - 0.1 && ld <= uLampEnd + 0.1) {
    float side = mod(k, 2.0) < 0.5 ? -1.0 : 1.0;
    float dd = d - ld;
    float dl = lat - side * uLampHeadLat;
    float pool = exp(-(dd * dd * 0.02 + dl * dl * 0.045));
    col += albedo * vec3(1.0, 0.74, 0.46) * pool * uNight * 3.2;
    col += vec3(1.0, 0.75, 0.5) * pool * uNight * paint * 0.2;
  }

  // Our headlights.
  float hl = headlight(vWorld);
  col += albedo * vec3(0.92, 0.96, 1.0) * hl * 2.4;
  col += vec3(0.9) * paint * hl * 0.6; // retroreflective paint

  float dist = length(vWorld - cameraPosition);
  col = applyFog(col, dist);
  gl_FragColor = vec4(col, uFade);
  ${outputChunk}
}
`;

// --- junction plate ------------------------------------------------------------

export const plateVertex = /* glsl */ `
varying vec2 vLocal;
varying vec3 vWorld;
void main() {
  vLocal = position.xy;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

export const plateFragment = /* glsl */ `
${common}
uniform float uHalf;
uniform float uHalfW;
uniform float uShoulder;
varying vec2 vLocal;
varying vec3 vWorld;

void main() {
  // Local: x = lateral, y = forward (plane rotated flat).
  vec2 q = abs(vLocal);
  float w = uHalfW + uShoulder;
  float r = 6.0;
  // Signed distance inside a "plus with filleted corners" outline.
  float fil = length(q - vec2(w + r)) - r;
  float dist;
  if (q.x >= w + r && q.y >= w + r) dist = -1.0;
  else if (q.x >= w + r) dist = w - q.y;
  else if (q.y >= w + r) dist = w - q.x;
  else if (q.x < w && q.y < w) dist = 99.0;
  else dist = max(max(w - q.x, w - q.y), fil);
  if (dist < 0.0) discard;

  vec2 wp = vWorld.xz;
  float n = fbm(wp * 0.35) * 0.6 + vnoise(wp * 6.0) * 0.4;
  vec3 asphalt = mix(vec3(0.03, 0.032, 0.036), vec3(0.052, 0.054, 0.06), n);
  vec3 gravel = mix(vec3(0.055, 0.054, 0.05), vec3(0.09, 0.087, 0.08), vnoise(wp * 3.0));
  vec3 albedo = mix(gravel, asphalt, smoothstep(uShoulder - 0.05, uShoulder + 0.05, dist));

  // Zebra crossings on each arm.
  float zebraBand = step(11.4, max(q.x, q.y)) * step(max(q.x, q.y), 14.0);
  float across = q.x > q.y ? vLocal.y : vLocal.x;
  float inRoad = step(abs(across), uHalfW - 0.4);
  float stripes = step(fract(across / 1.1), 0.5);
  float paint = zebraBand * inRoad * stripes;
  paint *= 0.7 + 0.3 * vnoise(wp * 9.0);
  albedo = mix(albedo, vec3(0.62), paint);

  vec3 N = vec3(0.0, 1.0, 0.0);
  vec3 col = albedo * (ambientLight(N) + sunLight(N));
  col += albedo * vec3(1.0, 0.74, 0.46) * uNight * 1.2 * exp(-dot(vLocal, vLocal) * 0.004);
  float hl = headlight(vWorld);
  col += albedo * vec3(0.92, 0.96, 1.0) * hl * 2.4 + vec3(0.9) * paint * hl * 0.6;
  col = applyFog(col, length(vWorld - cameraPosition));
  gl_FragColor = vec4(col, 1.0);
  ${outputChunk}
}
`;

// --- ground ---------------------------------------------------------------------

export const groundVertex = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

export const groundFragment = /* glsl */ `
${common}
varying vec3 vWorld;
void main() {
  vec2 p = vWorld.xz;
  float n = fbm(p * 0.018) * 0.65 + vnoise(p * 0.16) * 0.25 + vnoise(p * 1.7) * 0.1;
  vec3 grass = mix(vec3(0.032, 0.05, 0.022), vec3(0.075, 0.095, 0.04), n);
  vec3 dry = vec3(0.1, 0.09, 0.06);
  vec3 albedo = mix(grass, dry, 0.7 * smoothstep(0.55, 0.8, fbm(p * 0.006 + 3.0)));
  // Urban ground (paved lots) as the city grows.
  albedo = mix(albedo, vec3(0.07, 0.07, 0.075), uCity * 0.35 * smoothstep(0.4, 0.7, vnoise(p * 0.01 + 11.0)));
  vec3 N = vec3(0.0, 1.0, 0.0);
  vec3 col = albedo * (ambientLight(N) + sunLight(N));
  col += albedo * vec3(0.92, 0.96, 1.0) * headlight(vWorld) * 1.2;
  col = applyFog(col, length(vWorld - cameraPosition));
  gl_FragColor = vec4(col, 1.0);
  ${outputChunk}
}
`;

// --- sky --------------------------------------------------------------------------

export const skyVertex = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  vec4 w = modelMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * viewMatrix * w;
  gl_Position.z = gl_Position.w; // always at the far plane
}
`;

export const skyFragment = /* glsl */ `
${common}
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 col = mix(uSkyHorizon, uSkyTop, 1.0 - pow(1.0 - clamp(h, 0.0, 1.0), 3.2));
  col = mix(col, uFogColor, smoothstep(0.02, -0.06, h));

  float sd = max(dot(d, uSunDir), 0.0);
  float sunUp = smoothstep(-0.12, 0.02, uSunDir.y);
  float glow = pow(sd, 6.0) * 0.28 + pow(sd, 48.0) * 0.5;
  float horizonGlow = exp(-abs(h) * 7.0) * pow(sd, 2.5) * 0.5;
  col += uSunColor * (glow + horizonGlow) * min(uSunIntensity, 1.4) * 0.55;
  float disk = smoothstep(0.99955, 0.99975, sd) * smoothstep(-0.01, 0.01, h);
  col += uSunColor * disk * sunUp * mix(3.0, 1.2, uNight);

  // Stars.
  if (uStars > 0.01 && h > 0.0) {
    vec2 uv = vec2(atan(d.x, d.z), asin(h)) * 120.0;
    vec2 c = floor(uv);
    float r = hash12(c);
    float star = step(0.995, r) * smoothstep(0.22, 0.0, length(fract(uv) - 0.5));
    star *= 0.6 + 0.4 * sin(uTime * (1.0 + r * 3.0) + r * 40.0);
    col += vec3(0.85, 0.9, 1.0) * star * uStars * smoothstep(0.0, 0.25, h);
  }

  // Clouds on a virtual plane.
  if (h > 0.0) {
    vec2 cp = d.xz / (h + 0.08) * 0.55 + vec2(uTime * 0.004, uTime * 0.0015);
    float c = fbm(cp * 1.25);
    c = smoothstep(0.56, 0.86, c) * smoothstep(0.0, 0.18, h);
    vec3 cc = uCloudColor * (0.55 + 0.6 * pow(sd, 3.0));
    col = mix(col, cc, c * 0.6);
  }
  gl_FragColor = vec4(col, 1.0);
  ${outputChunk}
}
`;

// --- distant horizon (mountains + skyline) -------------------------------------

export const horizonVertex = /* glsl */ `
varying vec2 vUv;
varying vec3 vWorld;
void main() {
  vUv = uv;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

export const horizonFragment = /* glsl */ `
${common}
varying vec2 vUv;
varying vec3 vWorld;
void main() {
  float a = vUv.x * 6.2831853;
  float y = vUv.y; // 0 bottom … 1 top of the band
  // Mountains: layered ridges.
  float ridge = 0.18 + fbm(vec2(a * 3.0, 0.0)) * 0.34 + fbm(vec2(a * 11.0, 4.0)) * 0.08;
  float mountain = step(y, ridge);
  // City: blocky silhouettes whose height grows with uCity.
  float cell = floor(vUv.x * 900.0);
  float bh = hash12(vec2(cell, 3.0));
  float cluster = smoothstep(0.35, 0.8, fbm(vec2(a * 2.0, 9.0)));
  float bHeight = (0.04 + pow(bh, 3.0) * 0.28) * cluster * uCity;
  float building = step(y, bHeight) * step(0.02, bHeight);
  float mask = max(mountain, building);
  if (mask < 0.5) discard;

  vec3 far = mix(uFogColor, uSkyHorizon, 0.35) * 0.75;
  vec3 col = mix(far * 0.85, far * 0.6, building);
  // Lit windows at night.
  vec2 wg = vec2(vUv.x * 5400.0, y * 260.0);
  float win = step(0.55, hash12(floor(wg))) * step(0.3, fract(wg.x)) * step(0.35, fract(wg.y));
  col += vec3(1.0, 0.78, 0.5) * win * building * uNight * 0.35;
  // City glow at night.
  col += vec3(0.9, 0.55, 0.3) * uNight * uCity * 0.05 * (1.0 - y * 2.0);
  gl_FragColor = vec4(col, 1.0);
  ${outputChunk}
}
`;

// --- buildings (instanced or single) --------------------------------------------

export const buildingVertex = /* glsl */ `
#ifdef USE_INSTANCING
attribute float aSeed;
#else
uniform float aSeed;
#endif
varying vec3 vWorld;
varying vec3 vNormalW;
varying float vSeed;
varying vec3 vLocal;
void main() {
  vec4 local = vec4(position, 1.0);
  vec3 nrm = normal;
  #ifdef USE_INSTANCING
    local = instanceMatrix * local;
    nrm = mat3(instanceMatrix) * nrm;
  #endif
  vec4 w = modelMatrix * local;
  vWorld = w.xyz;
  vNormalW = normalize(mat3(modelMatrix) * nrm);
  vSeed = aSeed;
  vLocal = position;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

export const buildingFragment = /* glsl */ `
${common}
uniform vec3 uBase;
uniform float uGlass;       // 0 concrete … 1 curtain-wall glass
uniform float uFloorH;
uniform float uLit;         // probability a window is lit at night
varying vec3 vWorld;
varying vec3 vNormalW;
varying float vSeed;
varying vec3 vLocal;
void main() {
  vec3 N = normalize(vNormalW);
  vec3 base = uBase * (0.8 + 0.4 * hash12(vec2(vSeed * 91.0, 1.0)));
  vec3 col;
  if (abs(N.y) > 0.5) {
    col = base * 0.6 * (ambientLight(N) + sunLight(N));
  } else {
    vec2 t = vec2(-N.z, N.x);
    float u = dot(vWorld.xz, t);
    vec2 g = vec2(u / 2.2, vWorld.y / uFloorH);
    vec2 cellId = floor(g);
    vec2 f = fract(g);
    float isWin = step(0.16, f.x) * step(f.x, 0.84) * step(0.26, f.y) * step(f.y, 0.84) * step(0.6, vWorld.y);
    vec3 V = normalize(cameraPosition - vWorld);
    float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
    vec3 sky = mix(uSkyHorizon, uSkyTop, 0.4 + 0.4 * f.y);
    vec3 glass = mix(vec3(0.015, 0.02, 0.026), sky * 0.55, 0.18 + 0.6 * fres);
    glass += uSunColor * uSunIntensity * pow(max(dot(reflect(-V, N), uSunDir), 0.0), 40.0) * 0.4;
    vec3 wall = base * (ambientLight(N) + sunLight(N));
    col = mix(wall, glass, isWin * mix(0.85, 1.0, uGlass));
    float r = hash12(cellId + vSeed * 17.0);
    float lit = step(1.0 - uLit, r) * isWin;
    vec3 warm = mix(vec3(1.0, 0.72, 0.42), vec3(0.75, 0.85, 1.0), step(0.8, hash12(cellId * 1.7 + vSeed)));
    col += warm * lit * uNight * (0.18 + 0.32 * r);
  }
  col += base * headlight(vWorld) * 1.5;
  col = applyFog(col, length(vWorld - cameraPosition));
  gl_FragColor = vec4(col, 1.0);
  ${outputChunk}
}
`;

// --- glow sprites (lamp heads, distant lights) -----------------------------------

export const glowVertex = /* glsl */ `
uniform float uSize;
varying vec2 vUv;
varying float vFog;
uniform float uFogDensity;
void main() {
  vUv = uv;
  vec4 center = vec4(0.0, 0.0, 0.0, 1.0);
  #ifdef USE_INSTANCING
    center = instanceMatrix * center;
  #endif
  vec4 mv = modelViewMatrix * center;
  float dist = length(mv.xyz);
  mv.xy += position.xy * uSize * (1.0 + dist * 0.004);
  vFog = exp(-uFogDensity * uFogDensity * dist * dist * 0.5);
  gl_Position = projectionMatrix * mv;
}
`;

export const glowFragment = /* glsl */ `
uniform vec3 uColor;
uniform float uIntensity;
varying vec2 vUv;
varying float vFog;
void main() {
  float r = length(vUv - 0.5) * 2.0;
  float g = exp(-r * r * 5.0) + exp(-r * 18.0) * 0.8;
  gl_FragColor = vec4(uColor * g * uIntensity * vFog, 1.0);
}
`;
