"use client";

import { useMemo } from "react";
import { Text } from "@react-three/drei";
import { Color, MeshStandardMaterial, ShaderMaterial } from "three";
import { buildingFragment, buildingVertex, envUniforms } from "@/components/Scene/shaders";
import { FONT_BOLD, signText } from "@/components/Scene/materials";

const stone = new MeshStandardMaterial({ color: "#c9bfae", roughness: 0.85 });

/** Academic block with a colonnade and a gateway arch toward the road (local +Z). */
export function Campus({ name }: { name: string }) {
  const brick = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: { ...envUniforms(), uBase: { value: new Color("#9a6e55") }, uGlass: { value: 0.15 }, uFloorH: { value: 4.3 }, uLit: { value: 0.35 }, aSeed: { value: 0.44 } },
        vertexShader: buildingVertex,
        fragmentShader: buildingFragment,
      }),
    [],
  );
  const columns = Array.from({ length: 8 }, (_, i) => -17.5 + i * 5);
  return (
    <group>
      <mesh material={brick} position={[0, 7, -4]}>
        <boxGeometry args={[64, 14, 22]} />
      </mesh>
      {[-38, 38].map((x) => (
        <mesh key={x} material={brick} position={[x, 5, -10]}>
          <boxGeometry args={[14, 10, 30]} />
        </mesh>
      ))}
      {/* Colonnade and pediment */}
      {columns.map((x) => (
        <mesh key={x} material={stone} position={[x, 5.5, 8.5]}>
          <cylinderGeometry args={[0.55, 0.62, 11, 12]} />
        </mesh>
      ))}
      <mesh material={stone} position={[0, 11.6, 8.5]}>
        <boxGeometry args={[40, 1.3, 3.2]} />
      </mesh>
      <Text font={FONT_BOLD} fontSize={1.05} position={[0, 11.6, 10.15]} anchorX="center" anchorY="middle" material={signText("#2b2118")} letterSpacing={0.12}>
        {name.toUpperCase()}
      </Text>
      <mesh material={stone} position={[0, 0.25, 12]}>
        <boxGeometry args={[42, 0.5, 5]} />
      </mesh>
    </group>
  );
}
