/**
 * Lighting as storytelling: the time of day follows the career chronology.
 * Early career is pre-dawn → sunrise, mid career is daylight, the lead role
 * sits in golden hour, the present is evening and the end is night.
 *
 * `env` holds shared uniform objects referenced by every custom shader, so a
 * single per-frame update re-lights the whole world.
 */
import { Color, Vector3 } from "three";

interface Keyframe {
  year: number;
  skyTop: string;
  skyHorizon: string;
  sun: string;
  sunIntensity: number;
  /** degrees above horizon */
  sunElevation: number;
  /** degrees, 0 = world -Z, + = towards -X */
  sunAzimuth: number;
  fog: number;
  hemiSky: string;
  hemiGround: string;
  hemi: number;
  /** 0 day … 1 full night: lamps, windows, headlights */
  night: number;
  stars: number;
  clouds: string;
  exposure: number;
}

const keyframes: Keyframe[] = [
  { year: 2018.9, skyTop: "#04060c", skyHorizon: "#141b2b", sun: "#ff9a5a", sunIntensity: 0.0, sunElevation: -9, sunAzimuth: 20, fog: 0.0022, hemiSky: "#1a2336", hemiGround: "#07080a", hemi: 0.3, night: 1, stars: 0.9, clouds: "#1a2030", exposure: 0.95 },
  { year: 2019.35, skyTop: "#0e1a30", skyHorizon: "#c7846a", sun: "#ffb27a", sunIntensity: 0.9, sunElevation: 2, sunAzimuth: 18, fog: 0.0024, hemiSky: "#6d7c98", hemiGround: "#1a1714", hemi: 0.6, night: 0.45, stars: 0.15, clouds: "#d49a86", exposure: 1.0 },
  { year: 2020.3, skyTop: "#3a679d", skyHorizon: "#cdd6df", sun: "#fff0dc", sunIntensity: 2.2, sunElevation: 22, sunAzimuth: 8, fog: 0.0014, hemiSky: "#b3c6dd", hemiGround: "#3a3a32", hemi: 0.9, night: 0, stars: 0, clouds: "#f4f1ec", exposure: 1.0 },
  { year: 2022.3, skyTop: "#2e63a6", skyHorizon: "#bcd0e3", sun: "#fffaf0", sunIntensity: 2.7, sunElevation: 52, sunAzimuth: -25, fog: 0.001, hemiSky: "#c2d3e8", hemiGround: "#44423a", hemi: 1.0, night: 0, stars: 0, clouds: "#ffffff", exposure: 1.0 },
  { year: 2023.5, skyTop: "#34629a", skyHorizon: "#d5cfbe", sun: "#fff0d0", sunIntensity: 2.4, sunElevation: 30, sunAzimuth: -15, fog: 0.0012, hemiSky: "#c9cfd6", hemiGround: "#40392f", hemi: 0.95, night: 0, stars: 0, clouds: "#fbf4e8", exposure: 1.0 },
  { year: 2024.35, skyTop: "#2c3e66", skyHorizon: "#f0a55e", sun: "#ffae5e", sunIntensity: 2.0, sunElevation: 7, sunAzimuth: -10, fog: 0.0016, hemiSky: "#c29a7c", hemiGround: "#3a2a1e", hemi: 0.8, night: 0.1, stars: 0, clouds: "#ffc58c", exposure: 1.02 },
  { year: 2025.05, skyTop: "#1b2240", skyHorizon: "#dc6d48", sun: "#ff7a3c", sunIntensity: 1.1, sunElevation: 0.5, sunAzimuth: -8, fog: 0.0018, hemiSky: "#786a80", hemiGround: "#1e1614", hemi: 0.6, night: 0.5, stars: 0.05, clouds: "#e0805e", exposure: 1.0 },
  { year: 2025.7, skyTop: "#0c1126", skyHorizon: "#46375a", sun: "#ff6a3c", sunIntensity: 0.25, sunElevation: -5, sunAzimuth: -6, fog: 0.0017, hemiSky: "#384060", hemiGround: "#0e0c10", hemi: 0.45, night: 0.85, stars: 0.35, clouds: "#40385a", exposure: 1.0 },
  { year: 2026.35, skyTop: "#060914", skyHorizon: "#1b2238", sun: "#9fb4ff", sunIntensity: 0.18, sunElevation: 24, sunAzimuth: 30, fog: 0.0016, hemiSky: "#26304a", hemiGround: "#08080a", hemi: 0.35, night: 1, stars: 0.7, clouds: "#1c2236", exposure: 1.0 },
  { year: 2027, skyTop: "#03050b", skyHorizon: "#111728", sun: "#9fb4ff", sunIntensity: 0.14, sunElevation: 32, sunAzimuth: 35, fog: 0.0014, hemiSky: "#1f2740", hemiGround: "#060608", hemi: 0.3, night: 1, stars: 1, clouds: "#151a2a", exposure: 1.0 },
];

const col = (hex: string) => new Color(hex);
const parsed = keyframes.map((k) => ({
  ...k,
  cSkyTop: col(k.skyTop),
  cSkyHorizon: col(k.skyHorizon),
  cSun: col(k.sun),
  cHemiSky: col(k.hemiSky),
  cHemiGround: col(k.hemiGround),
  cClouds: col(k.clouds),
}));

export const env = {
  uSunDir: { value: new Vector3(0, 0.2, -1).normalize() },
  uSunColor: { value: new Color() },
  uSunIntensity: { value: 1 },
  uSkyTop: { value: new Color() },
  uSkyHorizon: { value: new Color() },
  uHemiSky: { value: new Color() },
  uHemiGround: { value: new Color() },
  uHemi: { value: 1 },
  uFogColor: { value: new Color() },
  uFogDensity: { value: 0.0015 },
  uNight: { value: 0 },
  uStars: { value: 0 },
  uCloudColor: { value: new Color() },
  uTime: { value: 0 },
  uCarPos: { value: new Vector3() },
  uCarDir: { value: new Vector3(0, 0, -1) },
  uHeadlights: { value: 0 },
  /** 0 = open country … 1 = dense city skyline */
  uCity: { value: 0 },
  exposure: 1,
};

export type EnvUniforms = typeof env;

const smooth = (t: number) => t * t * (3 - 2 * t);

/** Update shared uniforms for a fractional career year. */
export function applyChrono(year: number) {
  let i = 0;
  while (i < parsed.length - 2 && year > parsed[i + 1].year) i++;
  const a = parsed[i];
  const b = parsed[i + 1];
  const t = smooth(Math.min(Math.max((year - a.year) / (b.year - a.year), 0), 1));
  const lerp = (x: number, y: number) => x + (y - x) * t;

  env.uSkyTop.value.copy(a.cSkyTop).lerp(b.cSkyTop, t);
  env.uSkyHorizon.value.copy(a.cSkyHorizon).lerp(b.cSkyHorizon, t);
  env.uSunColor.value.copy(a.cSun).lerp(b.cSun, t);
  env.uHemiSky.value.copy(a.cHemiSky).lerp(b.cHemiSky, t);
  env.uHemiGround.value.copy(a.cHemiGround).lerp(b.cHemiGround, t);
  env.uCloudColor.value.copy(a.cClouds).lerp(b.cClouds, t);
  env.uFogColor.value.copy(env.uSkyHorizon.value).lerp(env.uSkyTop.value, 0.15);
  env.uSunIntensity.value = lerp(a.sunIntensity, b.sunIntensity);
  env.uHemi.value = lerp(a.hemi, b.hemi);
  env.uFogDensity.value = lerp(a.fog, b.fog);
  env.uNight.value = lerp(a.night, b.night);
  env.uStars.value = lerp(a.stars, b.stars);
  env.exposure = lerp(a.exposure, b.exposure);

  const el = (lerp(a.sunElevation, b.sunElevation) * Math.PI) / 180;
  const az = (lerp(a.sunAzimuth, b.sunAzimuth) * Math.PI) / 180;
  env.uSunDir.value.set(-Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)).normalize();

  // The skyline grows with the career.
  env.uCity.value = Math.min(Math.max((year - 2020.5) / 4, 0), 1);
  env.uHeadlights.value = Math.min(1, env.uNight.value * 1.2);
}

applyChrono(2018.9);
