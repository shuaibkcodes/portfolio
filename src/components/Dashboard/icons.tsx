import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement>;
const base = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;

export const TurnLeft = (p: P) => (
  <svg viewBox="0 0 24 24" {...base} {...p}>
    <path d="M16 21v-8a4 4 0 0 0-4-4H5" />
    <path d="M9 5 5 9l4 4" />
  </svg>
);
export const TurnRight = (p: P) => (
  <svg viewBox="0 0 24 24" {...base} {...p}>
    <path d="M8 21v-8a4 4 0 0 1 4-4h7" />
    <path d="m15 5 4 4-4 4" />
  </svg>
);
export const Straight = (p: P) => (
  <svg viewBox="0 0 24 24" {...base} {...p}>
    <path d="M12 21V4" />
    <path d="m6 10 6-6 6 6" />
  </svg>
);
export const Split = (p: P) => (
  <svg viewBox="0 0 24 24" {...base} {...p}>
    <path d="M12 21v-7" />
    <path d="M12 14 5 7M12 14l7-7M12 14V4" />
    <path d="M5 11V7h4M19 11V7h-4" />
  </svg>
);
export const Pin = (p: P) => (
  <svg viewBox="0 0 24 24" {...base} {...p}>
    <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Z" />
    <circle cx="12" cy="9.5" r="2.5" />
  </svg>
);
export const Flag = (p: P) => (
  <svg viewBox="0 0 24 24" {...base} {...p}>
    <path d="M5 21V4" />
    <path d="M5 4h11l-2 4 2 4H5" />
  </svg>
);
export const Merge = (p: P) => (
  <svg viewBox="0 0 24 24" {...base} {...p}>
    <path d="M12 21V11L6 4" />
    <path d="m18 4-6 7" />
  </svg>
);
export const SoundOn = (p: P) => (
  <svg viewBox="0 0 24 24" {...base} {...p}>
    <path d="M4 10v4h4l5 4V6L8 10H4Z" />
    <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" />
  </svg>
);
export const SoundOff = (p: P) => (
  <svg viewBox="0 0 24 24" {...base} {...p}>
    <path d="M4 10v4h4l5 4V6L8 10H4Z" />
    <path d="m17 10 4 4M21 10l-4 4" />
  </svg>
);
export const MapIcon = (p: P) => (
  <svg viewBox="0 0 24 24" {...base} {...p}>
    <path d="m3 6 6-2 6 2 6-2v14l-6 2-6-2-6 2V6Z" />
    <path d="M9 4v14M15 6v14" />
  </svg>
);
export const Help = (p: P) => (
  <svg viewBox="0 0 24 24" {...base} {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9.5a2.5 2.5 0 0 1 4.9.7c0 1.7-2.4 2.1-2.4 3.8M12 17h.01" />
  </svg>
);
export const Close = (p: P) => (
  <svg viewBox="0 0 24 24" {...base} {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </svg>
);
export const ArrowRight = (p: P) => (
  <svg viewBox="0 0 24 24" {...base} {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);
export const External = (p: P) => (
  <svg viewBox="0 0 24 24" {...base} {...p}>
    <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
  </svg>
);
export const Chevron = ({ dir, ...p }: P & { dir: "left" | "right" }) => (
  <svg viewBox="0 0 24 24" {...base} strokeWidth={2.6} {...p}>
    <path d={dir === "left" ? "M15 5 8 12l7 7" : "m9 5 7 7-7 7"} />
  </svg>
);
