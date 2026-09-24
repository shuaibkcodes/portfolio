"use client";

import { useEffect } from "react";
import { applyScroll, choose, closePanel, openPanel, setSteer, setThrottle } from "@/state/journey";
import { drive } from "@/state/drive";
import { useJourney } from "@/state/store";
import { nodes } from "@/world/graph";

/**
 * Wheel / trackpad / touch / keyboard / pointer → vehicle.
 * Scrolling advances the car; nothing requires game controls.
 */
export function useDriveInput(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;

    const insideScrollable = (t: EventTarget | null) => t instanceof Element && !!t.closest("[data-scroll-lock]");

    const onWheel = (e: WheelEvent) => {
      if (insideScrollable(e.target)) return;
      e.preventDefault();
      const unit = e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 800 : 1;
      // Horizontal trackpad swipes count too.
      const delta = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      applyScroll(delta * unit);
    };

    let touchY: number | null = null;
    const onTouchStart = (e: TouchEvent) => {
      if (insideScrollable(e.target) || e.touches.length !== 1) return;
      touchY = e.touches[0].clientY;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (touchY === null || insideScrollable(e.target)) return;
      const y = e.touches[0].clientY;
      applyScroll((touchY - y) * 2.4);
      touchY = y;
      e.preventDefault();
    };
    const onTouchEnd = () => {
      touchY = null;
    };

    const junctionKey = (dir: "left" | "straight" | "right") => {
      const st = useJourney.getState();
      if (st.hud.junction === "none" || st.choices.junctionA) return false;
      const exit = nodes.junctionA.exits.find((x) => x.dir === dir);
      if (exit) choose("junctionA", exit.edge);
      return true;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      const st = useJourney.getState();
      if (e.key === "Escape") {
        if (st.panel) closePanel();
        else if (st.mapOpen) st.setMapOpen(false);
        return;
      }
      if (st.panel || st.mapOpen) return;
      switch (e.key) {
        case "ArrowUp":
        case "w":
        case "W":
          if (!junctionKey("straight")) setThrottle(1);
          break;
        case "ArrowDown":
        case "s":
        case "S":
          setThrottle(-1);
          break;
        case "ArrowLeft":
        case "a":
        case "A":
          if (!junctionKey("left")) setSteer(-1);
          break;
        case "ArrowRight":
        case "d":
        case "D":
          if (!junctionKey("right")) setSteer(1);
          break;
        case "e":
        case "E":
        case "Enter":
          if (st.hud.nearby && !(target && target.closest("button, a"))) openPanel(st.hud.nearby.content);
          else return;
          break;
        case "m":
        case "M":
          st.setMapOpen(!st.mapOpen);
          break;
        default:
          return;
      }
      e.preventDefault();
    };

    const onKeyUp = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowUp":
        case "w":
        case "W":
        case "ArrowDown":
        case "s":
        case "S":
          setThrottle(0);
          break;
        case "ArrowLeft":
        case "a":
        case "A":
        case "ArrowRight":
        case "d":
        case "D":
          setSteer(0);
          break;
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      drive.look.x = (e.clientX / window.innerWidth) * 2 - 1;
      drive.look.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    const onPointerLeave = () => {
      drive.look.x = 0;
      drive.look.y = 0;
    };
    const onBlur = () => {
      setThrottle(0);
      setSteer(0);
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("pointermove", onPointerMove);
    document.documentElement.addEventListener("pointerleave", onPointerLeave);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("pointermove", onPointerMove);
      document.documentElement.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("blur", onBlur);
    };
  }, [enabled]);
}
