"use client";

import { memo, useMemo } from "react";
import { Text } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";
import { Color, MeshStandardMaterial, ShaderMaterial } from "three";
import { educationById, experienceById, formatPeriod, projectById } from "@/data/portfolio";
import { openPanel } from "@/state/journey";
import { edges, ROAD_HALF_WIDTH, SHOULDER } from "@/world/graph";
import type { SignStyle, StationPlacement } from "@/world/layout";
import { stationAnchor } from "@/world/scenery";
import { buildingFragment, buildingVertex, envUniforms } from "@/components/Scene/shaders";
import { FONT_BOLD, signText } from "@/components/Scene/materials";
import { PostSign, SignPanel, panelSize, type SignLine } from "@/components/RoadSigns/Sign";
import { Campus } from "@/components/Education/Campus";
import { SolarSite } from "@/components/Projects/SolarSite";

function facadeMaterial(base: string, glass: number, seed: number, lit = 0.45, floorH = 3.6) {
  return new ShaderMaterial({
    uniforms: { ...envUniforms(), uBase: { value: new Color(base) }, uGlass: { value: glass }, uFloorH: { value: floorH }, uLit: { value: lit }, aSeed: { value: seed } },
    vertexShader: buildingVertex,
    fragmentShader: buildingFragment,
  });
}

const accent = new MeshStandardMaterial({ color: "#1a1d22", emissive: new Color("#9cc7ff"), emissiveIntensity: 0.6, toneMapped: false });

/** Company name mounted on a facade / roof, faces local +Z. */
function FacadeName({ text, size, y, z }: { text: string; size: number; y: number; z: number }) {
  return (
    <Text font={FONT_BOLD} fontSize={size} position={[0, y, z]} anchorX="center" anchorY="middle" material={signText("#f4f6f8")} letterSpacing={0.08}>
      {text.toUpperCase()}
    </Text>
  );
}

function Studio({ name }: { name: string }) {
  const mat = useMemo(() => facadeMaterial("#8e9299", 0.55, 0.31, 0.5), []);
  return (
    <group>
      <mesh material={mat} position={[0, 4.5, 0]}>
        <boxGeometry args={[20, 9, 14]} />
      </mesh>
      <mesh material={mat} position={[-6, 11, -2]}>
        <boxGeometry args={[8, 4, 8]} />
      </mesh>
      <FacadeName text={name} size={1.25} y={10.3} z={7.2} />
    </group>
  );
}

function Office({ name }: { name: string }) {
  const mat = useMemo(() => facadeMaterial("#56616e", 0.9, 0.62, 0.55), []);
  return (
    <group>
      <mesh material={mat} position={[0, 9, 0]}>
        <boxGeometry args={[30, 18, 22]} />
      </mesh>
      <mesh material={accent} position={[0, 18.15, 11.05]}>
        <boxGeometry args={[30.2, 0.3, 0.1]} />
      </mesh>
      <FacadeName text={name} size={2.4} y={15.2} z={11.1} />
    </group>
  );
}

function Tower({ name }: { name: string }) {
  const podium = useMemo(() => facadeMaterial("#4c5560", 0.8, 0.12, 0.5, 4.2), []);
  const tower = useMemo(() => facadeMaterial("#3f4955", 1, 0.87, 0.5), []);
  return (
    <group>
      <mesh material={podium} position={[0, 3.6, 2]}>
        <boxGeometry args={[46, 7.2, 30]} />
      </mesh>
      <mesh material={tower} position={[0, 50, -2]}>
        <boxGeometry args={[24, 100, 24]} />
      </mesh>
      <mesh material={tower} position={[0, 104, -2]}>
        <boxGeometry args={[18, 8, 18]} />
      </mesh>
      {[-12.05, 12.05].map((x) => (
        <mesh key={x} material={accent} position={[x, 50, 10.05]}>
          <boxGeometry args={[0.2, 100, 0.2]} />
        </mesh>
      ))}
      <mesh material={accent} position={[0, 100.2, 10.05]}>
        <boxGeometry args={[24.2, 0.4, 0.2]} />
      </mesh>
      <FacadeName text={name} size={3.4} y={95} z={10.15} />
      <FacadeName text={name} size={1.6} y={8.6} z={17.1} />
    </group>
  );
}

const STYLE_FOR = { experience: "career", education: "education", project: "project" } as const satisfies Record<string, SignStyle>;

function stationContent(st: StationPlacement) {
  const { type, id } = st.content;
  if (type === "experience") {
    const e = experienceById[id];
    return {
      name: e.company,
      lines: [
        { text: e.company, size: 0.85 },
        { text: e.role, size: 0.5 },
        { text: formatPeriod(e.period), size: 0.4, bold: false },
      ] as SignLine[],
      tags: e.signTags,
    };
  }
  if (type === "education") {
    const e = educationById[id];
    return {
      name: e.institution,
      lines: [
        { text: e.institution, size: 0.7 },
        { text: e.degree, size: 0.46 },
        { text: formatPeriod(e.period), size: 0.4, bold: false },
      ] as SignLine[],
      tags: e.signTags,
    };
  }
  const p = projectById[id];
  return {
    name: p.name,
    lines: [
      { text: p.name, size: 0.95 },
      { text: p.signTagline ?? p.tagline, size: 0.4, bold: false },
      { text: "View project", size: 0.36 },
    ] as SignLine[],
    tags: p.technologies.slice(0, 4),
  };
}

/**
 * An experience / education / project location: architecture set back from
 * the road, a destination sign at the kerb, and short tag signs after it.
 */
export const Station = memo(function Station({ station }: { station: StationPlacement }) {
  const anchor = stationAnchor(station);
  const path = edges[station.edge].path;
  const sideSign = station.side === "left" ? -1 : 1;
  const signLat = sideSign * (ROAD_HALF_WIDTH + SHOULDER + 3.2);
  const sign = path.pointAt(station.d - 10, signLat);
  const tags = path.pointAt(station.d + 48, sideSign * (ROAD_HALF_WIDTH + SHOULDER + 1.6));
  const approach = station.approach ? path.pointAt(station.d - 120, sideSign * (ROAD_HALF_WIDTH + SHOULDER + 1.6)) : null;
  const content = stationContent(station);
  const style = STYLE_FOR[station.content.type];
  const signSize = panelSize(content.lines, undefined, 6.5);
  const tagLines = content.tags.map((t) => [{ text: t, size: 0.42 }] as SignLine[]);
  const tagW = Math.max(3.2, ...tagLines.map((l) => panelSize(l).w));
  const yaw = sideSign < 0 ? 0.22 : -0.22;

  const open = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    openPanel(station.content);
  };
  const hover = {
    onPointerOver: () => (document.body.style.cursor = "pointer"),
    onPointerOut: () => (document.body.style.cursor = ""),
  };

  return (
    <group>
      <group position={[anchor.x, 0, anchor.z]} rotation-y={anchor.rot} onClick={open} {...hover}>
        {station.building === "studio" && <Studio name={content.name} />}
        {station.building === "office" && <Office name={content.name} />}
        {station.building === "tower" && <Tower name={content.name} />}
        {station.building === "campus" && <Campus name={content.name} />}
        {station.building === "solarSite" && <SolarSite name={content.name} />}
      </group>

      <group position={[sign.x, 0, sign.z]} rotation-y={sign.h + yaw}>
        <PostSign w={signSize.w} h={signSize.h} clearance={1.8}>
          <SignPanel style={style} lines={content.lines} minWidth={6.5} onClick={open} />
        </PostSign>
      </group>

      {tagLines.length > 0 && (
        <group position={[tags.x, 0, tags.z]} rotation-y={tags.h + yaw}>
          <PostSign w={tagW} h={tagLines.length * 1.22} clearance={1.6}>
            {tagLines.map((l, i) => (
              <group key={i} position-y={((tagLines.length - 1) / 2 - i) * 1.22}>
                <SignPanel style={style} lines={l} minWidth={tagW} pad={0.36} />
              </group>
            ))}
          </PostSign>
        </group>
      )}

      {approach && (
        <group position={[approach.x, 0, approach.z]} rotation-y={approach.h + yaw}>
          <PostSign w={4} h={1.8}>
            <SignPanel style={style} lines={[{ text: station.approach!, size: 0.55 }]} />
          </PostSign>
        </group>
      )}
    </group>
  );
});
