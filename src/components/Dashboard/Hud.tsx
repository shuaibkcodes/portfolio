"use client";

import { useEffect, useRef, useState } from "react";
import { profile, closing } from "@/data/portfolio";
import { audio } from "@/lib/audio";
import { openPanel, restart, startJourney, travelTo } from "@/state/journey";
import { useJourney } from "@/state/store";
import { destinations } from "@/world/destinations";
import { SEP } from "@/lib/text";
import { Gps, JunctionChooser, MapOverlay } from "@/components/Navigation/Gps";
import { DetailPanel } from "@/components/Panels/DetailPanel";
import s from "./hud.module.css";
import { ArrowRight, Chevron, External, Help, MapIcon, SoundOff, SoundOn } from "./icons";

const initials = profile.name
  .split(" ")
  .filter((w) => w.length > 2)
  .slice(-2)
  .map((w) => w[0])
  .join("");

function Identity() {
  return (
    <header className={`${s.identity} ${s.glass}`}>
      <div className={s.plate} aria-hidden>
        {initials}
      </div>
      <div>
        <p className={s.name}>{profile.name}</p>
        <p className={s.role}>
          {profile.title}
          <span className={s.discipline}>
            {SEP}
            {profile.discipline}
          </span>
        </p>
        <nav className={s.links} aria-label="Contact">
          <a href={profile.links.linkedin} target="_blank" rel="noreferrer">
            LinkedIn
          </a>
          <a href={profile.links.github} target="_blank" rel="noreferrer">
            GitHub
          </a>
          <a href={`mailto:${profile.email}`}>Email</a>
        </nav>
      </div>
    </header>
  );
}

function Controls() {
  const mode = useJourney((st) => st.mode);
  const setMode = useJourney((st) => st.setMode);
  const sound = useJourney((st) => st.sound);
  const setSound = useJourney((st) => st.setSound);
  const mapOpen = useJourney((st) => st.mapOpen);
  const setMapOpen = useJourney((st) => st.setMapOpen);
  const mobile = useJourney((st) => st.mobile);
  const [help, setHelp] = useState(false);

  return (
    <>
      <div className={s.controls}>
        <div className={`${s.segmented} ${s.glass}`} role="group" aria-label="Driving mode">
          <button type="button" className={s.segBtn} aria-pressed={mode === "autopilot"} onClick={() => setMode("autopilot")}>
            Autopilot
          </button>
          <button type="button" className={s.segBtn} aria-pressed={mode === "explore"} onClick={() => setMode("explore")}>
            Explore
          </button>
        </div>
        <button
          type="button"
          className={`${s.iconBtn} ${s.glass}`}
          aria-pressed={sound}
          aria-label={sound ? "Mute sound" : "Enable sound"}
          onClick={() => {
            audio.setEnabled(!sound);
            setSound(!sound);
          }}
        >
          {sound ? <SoundOn width={19} /> : <SoundOff width={19} />}
        </button>
        <button type="button" className={`${s.iconBtn} ${s.glass}`} aria-pressed={mapOpen} aria-label="Open journey map (M)" onClick={() => setMapOpen(!mapOpen)}>
          <MapIcon width={19} />
        </button>
        {!mobile && (
          <button type="button" className={`${s.iconBtn} ${s.glass}`} aria-pressed={help} aria-expanded={help} aria-label="Controls" onClick={() => setHelp(!help)}>
            <Help width={19} />
          </button>
        )}
      </div>
      {help && (
        <div className={`${s.help} ${s.glass}`}>
          <dl>
            <dt>Scroll</dt>
            <dd>Drive forward / back</dd>
            <dt>↑ ↓ · W S</dt>
            <dd>Accelerate / brake</dd>
            <dt>← → · A D</dt>
            <dd>Change lane{SEP}pick a road at junctions</dd>
            <dt>E</dt>
            <dd>Open the location you&apos;re passing</dd>
            <dt>M</dt>
            <dd>Journey map &amp; destinations</dd>
            <dt>Click</dt>
            <dd>Buildings and signs open details</dd>
          </dl>
        </div>
      )}
    </>
  );
}

const YEARS = [2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];
const districtName = { education: "Education", projects: "Projects", career: "Career" } as const;

function HeadUp() {
  const hud = useJourney((st) => st.hud);
  const mobile = useJourney((st) => st.mobile);
  const minY = YEARS[0];
  const maxY = YEARS[YEARS.length - 1] + 1;
  const markerYear = hud.year ?? 2021.95;
  const pct = Math.round(hud.progress * 100);

  return (
    <div className={`${s.hud} ${s.glass}`} aria-hidden>
      <span className={`${s.signal} ${hud.signal === "left" ? s.signalOn : ""}`}>
        <Chevron dir="left" width={24} />
      </span>
      <div className={s.speed}>
        {hud.speed}
        <span className={s.unit}>KM/H</span>
      </div>
      <div className={s.yearBlock}>
        {hud.year !== null ? (
          <>
            <div className={s.yearLabel}>Year</div>
            <div key={hud.year} className={`${s.year} ${s.yearChange}`}>
              {hud.year}
            </div>
          </>
        ) : (
          <>
            <div className={s.yearLabel}>Side road</div>
            <div className={s.district}>{districtName[hud.district]}</div>
          </>
        )}
        {!mobile && <div className={s.location}>{hud.location}</div>}
      </div>
      <div className={s.journey}>
        <div className={s.yearLabel}>Journey</div>
        <div className={s.journeyPct}>{pct}%</div>
        <div className={s.bar}>
          <div className={s.barFill} style={{ width: `${pct}%` }} />
        </div>
      </div>
      <span className={`${s.signal} ${hud.signal === "right" ? s.signalOn : ""}`}>
        <Chevron dir="right" width={24} />
      </span>
      {!mobile && (
        <div className={s.timeline}>
          <div className={s.timelineTrack} />
          {YEARS.map((y) => (
            <span key={y} className={`${s.tick} ${hud.year !== null && y <= hud.year ? s.tickPast : ""}`} style={{ left: `${((y - minY) / (maxY - minY)) * 100}%` }}>
              {y}
            </span>
          ))}
          <span className={s.marker} style={{ left: `${((Math.min(markerYear + 0.5, maxY) - minY) / (maxY - minY)) * 100}%` }} />
        </div>
      )}
    </div>
  );
}

function Prompt() {
  const nearby = useJourney((st) => st.hud.nearby);
  const panel = useJourney((st) => st.panel);
  const mobile = useJourney((st) => st.mobile);
  if (!nearby || panel) return null;
  const isProject = nearby.content.type === "project";
  return (
    <button type="button" className={`${s.prompt} ${s.glass}`} onClick={() => openPanel(nearby.content)}>
      <span>
        <span className={s.promptLabel}>{nearby.label}</span>
        <br />
        <span className={s.promptSub}>{isProject ? "Project destination" : nearby.content.type === "education" ? "Education" : "Career stop"}</span>
      </span>
      <span className={s.kbd}>
        {isProject ? "View project" : "Details"} {mobile ? "" : "· E"}
      </span>
    </button>
  );
}

function Toast() {
  const toast = useJourney((st) => st.toast);
  if (!toast) return null;
  return (
    <div key={toast.id} className={`${s.toast} ${s.glass}`}>
      <div className={s.toastText}>{toast.text}</div>
      {toast.sub && <div className={s.toastSub}>{toast.sub}</div>}
    </div>
  );
}

/** Screen-reader narration of the drive. */
function LiveRegion() {
  const [msg, setMsg] = useState("");
  useEffect(
    () =>
      useJourney.subscribe((st, prev) => {
        if (st.toast && st.toast !== prev.toast) setMsg(`${st.toast.text}${st.toast.sub ? `. ${st.toast.sub}` : ""}`);
        else if (st.hud.year && st.hud.year !== prev.hud.year) setMsg(`Entering ${st.hud.year}`);
        else if (st.hud.nearby && st.hud.nearby.label !== prev.hud.nearby?.label) setMsg(`Approaching ${st.hud.nearby.label}. Press E for details.`);
      }),
    [],
  );
  return (
    <div className="sr-only" aria-live="polite">
      {msg}
    </div>
  );
}

// --- cards ----------------------------------------------------------------------------

export function TitleCard({ onClassic }: { onClassic: () => void }) {
  const sound = useJourney((st) => st.sound);
  const setSound = useJourney((st) => st.setSound);
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => btn.current?.focus({ preventScroll: true }), []);
  return (
    <div className={s.cardScrim}>
      <div className={s.title}>
        <div className={s.kicker}>The road so far</div>
        <h1 className={s.bigName}>{profile.name}</h1>
        <p className={s.bigRole}>
          {profile.title}
          {SEP}
          {profile.discipline}
        </p>
        <div className={s.startRow}>
          <button ref={btn} type="button" className={s.start} onClick={startJourney}>
            Start the journey <ArrowRight width={18} />
          </button>
          <div className={s.subRow}>
            <button type="button" className={s.linkBtn} aria-pressed={sound} onClick={() => setSound(!sound)}>
              Sound: {sound ? "on" : "off"}
            </button>
            <span aria-hidden>·</span>
            <button type="button" className={s.linkBtn} onClick={onClassic}>
              Prefer reading? Classic view
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EndCard() {
  const visited = useJourney((st) => st.visitedStations);
  const missed = destinations.filter((d) => d.kind === "station" && !visited.includes(d.id));
  return (
    <div className={`${s.cardScrim} ${s.endScrim}`}>
      <div className={s.end}>
        {/* The physical sign in the world says it; keep the heading for assistive tech. */}
        <h2 className="sr-only">
          {closing.headline} — {closing.sub}
        </h2>
        <p className={s.bigName} style={{ fontSize: "clamp(28px, 4.4vw, 50px)", marginTop: 0 }}>
          {profile.name}
        </p>
        <p className={s.bigRole}>{profile.title}</p>
        <p className={s.endStatement}>{closing.statement}</p>
        <div className={s.endActions}>
          <a className={`${s.btn} ${s.btnPrimary}`} href={`mailto:${profile.email}`}>
            Contact me
          </a>
          <a className={s.btn} href={profile.links.linkedin} target="_blank" rel="noreferrer">
            LinkedIn <External width={15} />
          </a>
          <a className={s.btn} href={profile.links.github} target="_blank" rel="noreferrer">
            GitHub <External width={15} />
          </a>
          {profile.resumeUrl && (
            <a className={s.btn} href={profile.resumeUrl} download>
              Download resume
            </a>
          )}
          <button type="button" className={s.btn} onClick={restart}>
            Restart journey
          </button>
        </div>
        {missed.length > 0 && (
          <div className={s.subRow} style={{ justifyContent: "center", marginTop: 22, flexWrap: "wrap" }}>
            <span>Roads not taken:</span>
            {missed.slice(0, 4).map((d) => (
              <button key={d.id} type="button" className={s.linkBtn} onClick={() => travelTo(d.id)}>
                {d.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// --- composition ------------------------------------------------------------------------

export function Hud({ onClassic }: { onClassic: () => void }) {
  const phase = useJourney((st) => st.phase);
  const panel = useJourney((st) => st.panel);
  const mapOpen = useJourney((st) => st.mapOpen);
  const driving = phase === "driving" || phase === "arrived";
  return (
    <>
      <div className={`${s.layer} ${phase === "title" ? s.layerOn : ""}`}>{phase === "title" && <TitleCard onClassic={onClassic} />}</div>
      <div className={`${s.layer} ${driving ? s.layerOn : ""}`} aria-hidden={!driving}>
        {driving && (
          <>
            <Identity />
            <Controls />
            {phase === "driving" && (
              <>
                <HeadUp />
                <Gps />
                {!panel && !mapOpen && (
                  <>
                    <Prompt />
                    <JunctionChooser />
                  </>
                )}
              </>
            )}
            <Toast />
            {phase === "arrived" && !panel && !mapOpen && <EndCard />}
            <DetailPanel />
            <MapOverlay />
            <LiveRegion />
          </>
        )}
      </div>
    </>
  );
}
