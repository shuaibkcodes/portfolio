"use client";

import { Text } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import type { ReactNode } from "react";
import type { SignStyle } from "@/world/layout";
import {
  FONT,
  FONT_BOLD,
  SIGN_COLORS,
  arrowGeometry,
  arrowRotation,
  diamondGeometry,
  metal,
  roundedRect,
  signBack,
  signFace,
  signText,
  textWidth,
} from "@/components/Scene/materials";

export interface SignLine {
  text: string;
  size: number;
  bold?: boolean;
}

export interface PanelProps {
  style: SignStyle;
  lines: SignLine[];
  arrow?: "left" | "right" | "up";
  minWidth?: number;
  pad?: number;
  highlight?: boolean;
  onClick?: (e: ThreeEvent<MouseEvent>) => void;
}

const GAP = 0.28;

export function panelSize(lines: SignLine[], arrow?: string, minWidth = 0, pad = 0.55) {
  const textW = Math.max(...lines.map((l) => textWidth(l.text.toUpperCase(), l.size)));
  const textH = lines.reduce((sum, l) => sum + l.size, 0) + GAP * (lines.length - 1);
  const arrowW = arrow ? textH * 0.9 + 0.4 : 0;
  return { w: Math.max(minWidth, textW + arrowW + pad * 2), h: textH + pad * 2, textH, arrowW };
}

/** A sign face centred on its local origin, facing +Z. */
export function SignPanel({ style, lines, arrow, minWidth, pad = 0.55, highlight, onClick }: PanelProps) {
  const c = SIGN_COLORS[style];
  const { w, h, textH, arrowW } = panelSize(lines, arrow, minWidth, pad);
  const border = 0.09;
  // Vertical centre of each line, top to bottom.
  const centres = lines.map((_, i) => textH / 2 - lines.slice(0, i).reduce((sum, l) => sum + l.size + GAP, 0) - lines[i].size / 2);
  const textX = arrow === "left" ? arrowW / 2 : arrow ? -arrowW / 2 : 0;
  const arrowX = arrow === "left" ? -w / 2 + pad + (arrowW - 0.4) / 2 : w / 2 - pad - (arrowW - 0.4) / 2;

  return (
    <group
      onClick={onClick}
      onPointerOver={onClick ? () => (document.body.style.cursor = "pointer") : undefined}
      onPointerOut={onClick ? () => (document.body.style.cursor = "") : undefined}
    >
      <mesh geometry={roundedRect(w + 0.08, h + 0.08, 0.34)} material={signBack} position-z={-0.03} rotation-y={Math.PI} />
      <mesh geometry={roundedRect(w, h, 0.3)} material={signFace(highlight ? "#f5f7fa" : c.border)} />
      <mesh geometry={roundedRect(w - border * 2, h - border * 2, 0.24)} material={signFace(c.bg)} position-z={0.005} />
      {lines.map((l, i) => (
        <Text
          key={i}
          font={l.bold === false ? FONT : FONT_BOLD}
          fontSize={l.size}
          position={[textX, centres[i], 0.02]}
          anchorX="center"
          anchorY="middle"
          material={signText(c.fg)}
          letterSpacing={0.015}
        >
          {l.text.toUpperCase()}
        </Text>
      ))}
      {arrow && (
        <mesh
          geometry={arrowGeometry()}
          material={signText(c.fg)}
          position={[arrowX, 0, 0.02]}
          rotation-z={arrowRotation[arrow]}
          scale={Math.min(textH * 0.95, 2.2)}
        />
      )}
    </group>
  );
}

/** Diamond warning sign (yellow / orange) with up to three short lines. */
export function DiamondSign({ style, lines }: { style: SignStyle; lines: string[] }) {
  const c = SIGN_COLORS[style];
  const size = 1.55;
  const fs = lines.length > 2 ? 0.3 : 0.36;
  return (
    <group>
      <mesh geometry={diamondGeometry()} material={signBack} scale={size + 0.04} position-z={-0.03} rotation-y={Math.PI} />
      <mesh geometry={diamondGeometry()} material={signFace(c.border)} scale={size} />
      <mesh geometry={diamondGeometry()} material={signFace(c.bg)} scale={size - 0.1} position-z={0.005} />
      {lines.map((t, i) => (
        <Text
          key={i}
          font={FONT_BOLD}
          fontSize={fs}
          position={[0, ((lines.length - 1) / 2 - i) * fs * 1.15, 0.02]}
          anchorX="center"
          anchorY="middle"
          material={signText(c.fg)}
        >
          {t.toUpperCase()}
        </Text>
      ))}
    </group>
  );
}

/** Posts from the ground up to `height`, spaced to fit a panel of width `w`. */
export function Posts({ w, height, twin }: { w: number; height: number; twin?: boolean }) {
  const xs = twin ? [-w * 0.3, w * 0.3] : [0];
  return (
    <>
      {xs.map((x) => (
        <mesh key={x} material={metal} position={[x, height / 2, -0.06]}>
          <cylinderGeometry args={[0.06, 0.07, height, 8]} />
        </mesh>
      ))}
    </>
  );
}

/** Roadside sign: panel on posts, bottom edge at `clearance`. */
export function PostSign({ children, w, h, clearance = 2.2 }: { children: ReactNode; w: number; h: number; clearance?: number }) {
  return (
    <group>
      <Posts w={w} height={clearance + h * 0.85} twin={w > 3.2} />
      <group position-y={clearance + h / 2}>{children}</group>
    </group>
  );
}

/** Steel overhead gantry spanning the carriageway (local X across, faces +Z). */
export function GantryFrame({ span, height }: { span: number; height: number }) {
  return (
    <group>
      {[-span / 2, span / 2].map((x) => (
        <mesh key={x} material={metal} position={[x, height / 2, 0]}>
          <cylinderGeometry args={[0.16, 0.2, height, 10]} />
        </mesh>
      ))}
      {[height - 0.25, height + 0.55].map((y) => (
        <mesh key={y} material={metal} position={[0, y, -0.2]}>
          <boxGeometry args={[span + 0.6, 0.16, 0.16]} />
        </mesh>
      ))}
    </group>
  );
}
