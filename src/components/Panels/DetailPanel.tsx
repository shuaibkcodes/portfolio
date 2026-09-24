"use client";

import { useEffect, useRef } from "react";
import { educationById, experienceById, formatPeriod, projectById, projects } from "@/data/portfolio";
import { closePanel } from "@/state/journey";
import { useJourney } from "@/state/store";
import { exitLabel, SEP } from "@/lib/text";
import s from "@/components/Dashboard/hud.module.css";
import { ArrowRight, Close, External } from "@/components/Dashboard/icons";

function Chips({ items }: { items: string[] }) {
  return (
    <ul className={s.chips}>
      {items.map((t) => (
        <li key={t} className={s.chip}>
          {t}
        </li>
      ))}
    </ul>
  );
}

function List({ items }: { items: string[] }) {
  return (
    <ul className={s.list}>
      {items.map((t) => (
        <li key={t}>{t}</li>
      ))}
    </ul>
  );
}

export function DetailPanel() {
  const panel = useJourney((st) => st.panel);
  const closeRef = useRef<HTMLButtonElement>(null);
  const lastFocus = useRef<Element | null>(null);

  useEffect(() => {
    if (!panel) return;
    lastFocus.current = document.activeElement;
    closeRef.current?.focus();
    return () => {
      if (lastFocus.current instanceof HTMLElement) lastFocus.current.focus();
    };
  }, [panel]);

  if (!panel) return null;

  let body: React.ReactNode = null;
  let eyebrow = "";
  let color = "var(--career)";

  if (panel.type === "experience") {
    const e = experienceById[panel.id];
    eyebrow = "Experience";
    body = (
      <>
        <h2 id="panel-title">{e.role}</h2>
        <p className={s.panelCompany}>
          {e.company}
          {e.companyBlurb ? ` — ${e.companyBlurb}` : ""}
        </p>
        <p className={s.panelPeriod}>
          {formatPeriod(e.period)}
          {e.location ? ` · ${e.location}` : ""}
        </p>
        <p className={s.panelLead}>{e.summary}</p>
        {e.highlights.length > 0 && (
          <>
            <h3>Responsibilities &amp; achievements</h3>
            <List items={e.highlights} />
          </>
        )}
        {e.technologies.length > 0 && (
          <>
            <h3>Technologies</h3>
            <Chips items={e.technologies} />
          </>
        )}
        {e.highlights.length === 0 && <p className={s.muted}>More detail about this role is coming soon.</p>}
      </>
    );
  } else if (panel.type === "education") {
    const e = educationById[panel.id];
    eyebrow = "Education";
    color = "var(--education)";
    body = (
      <>
        <h2 id="panel-title">{e.degree}</h2>
        <p className={s.panelCompany}>{e.institution}</p>
        <p className={s.panelPeriod}>{formatPeriod(e.period)}</p>
        {e.major && (
          <>
            <h3>Major</h3>
            <p className={s.panelLead} style={{ marginTop: 0 }}>
              {e.major}
            </p>
          </>
        )}
        {e.highlights.length > 0 && (
          <>
            <h3>Highlights</h3>
            <List items={e.highlights} />
          </>
        )}
      </>
    );
  } else {
    const p = projectById[panel.id];
    eyebrow = `Project${SEP}${exitLabel(projects.indexOf(p) + 1)}`;
    color = "var(--project)";
    body = (
      <>
        <h2 id="panel-title">{p.name}</h2>
        <p className={s.panelCompany}>{p.tagline}</p>
        <h3>The problem</h3>
        <p className={s.panelLead} style={{ marginTop: 0 }}>
          {p.problem}
        </p>
        <h3>My role</h3>
        <p className={s.panelLead} style={{ marginTop: 0 }}>
          {p.role}
        </p>
        <h3>Architecture</h3>
        <div className={s.arch}>
          {p.architecture.map((layer, i) => (
            <div key={layer.label}>
              <div className={s.archRow}>
                <span className={s.archLabel}>{layer.label}</span>
                <span className={s.archItems}>{layer.items.join(SEP)}</span>
              </div>
              {i < p.architecture.length - 1 && (
                <div className={s.archArrow} aria-hidden>
                  ↓
                </div>
              )}
            </div>
          ))}
        </div>
        {p.challenges.length > 0 && (
          <>
            <h3>Engineering challenges</h3>
            <List items={p.challenges} />
          </>
        )}
        <h3>Delivered</h3>
        <List items={p.highlights} />
        {p.outcome && (
          <>
            <h3>Outcome</h3>
            <p className={s.panelLead} style={{ marginTop: 0 }}>
              {p.outcome}
            </p>
          </>
        )}
        <h3>Technology</h3>
        <Chips items={p.technologies} />
        {(p.url || p.repo) && (
          <div className={s.panelActions}>
            {p.url && (
              <a className={`${s.btn} ${s.btnPrimary}`} href={p.url} target="_blank" rel="noreferrer">
                View project <External width={16} />
              </a>
            )}
            {p.repo && (
              <a className={s.btn} href={p.repo} target="_blank" rel="noreferrer">
                Source <External width={16} />
              </a>
            )}
          </div>
        )}
      </>
    );
  }

  return (
    <aside className={`${s.panel} ${s.glass}`} role="dialog" aria-modal="false" aria-labelledby="panel-title" data-scroll-lock>
      <div className={s.panelTop}>
        <span className={s.eyebrow} style={{ background: color }}>
          {eyebrow}
        </span>
        <button ref={closeRef} type="button" className={s.iconBtn} style={{ border: 0, background: "none" }} onClick={closePanel} aria-label="Close details (Esc)">
          <Close width={20} />
        </button>
      </div>
      {body}
      <div className={s.panelActions}>
        <button type="button" className={s.btn} onClick={closePanel}>
          Continue driving <ArrowRight width={16} />
        </button>
      </div>
    </aside>
  );
}
