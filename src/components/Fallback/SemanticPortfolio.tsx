import { closing, education, experience, formatPeriod, profile, projects, skills } from "@/data/portfolio";
import { SEP } from "@/lib/text";
import d from "./document.module.css";

/**
 * The portfolio as a semantic document. Server-rendered for SEO and assistive
 * technology; shown as the 2D "road" when WebGL / motion isn't available.
 */
export function SemanticPortfolio() {
  const career = [...experience].reverse();
  return (
    <div id="portfolio-document" className={d.doc}>
      <header className={d.hero}>
        <p className={d.kicker}>The road so far</p>
        <h1 className={d.name}>{profile.name}</h1>
        <p className={d.title}>
          {profile.title}
          {SEP}
          {profile.discipline}
        </p>
        <p className={d.summary}>{profile.summary}</p>
        <nav className={d.links} aria-label="Contact">
          <a href={`mailto:${profile.email}`}>{profile.email}</a>
          <a href={profile.links.linkedin}>LinkedIn</a>
          <a href={profile.links.github}>GitHub</a>
          {profile.resumeUrl && <a href={profile.resumeUrl}>Resume</a>}
        </nav>
      </header>

      <main className={d.road}>
        <section aria-labelledby="career-h" className={d.section}>
          <h2 id="career-h" className={d.sectionSign}>
            Career road
          </h2>
          <ol className={d.timeline}>
            {career.map((e) => (
              <li key={e.id} className={d.stop}>
                <span className={d.year} aria-hidden>
                  {e.period.start?.slice(0, 4)}
                </span>
                <article className={d.card}>
                  <h3 className={d.role}>{e.role}</h3>
                  <p className={d.org}>{e.company}</p>
                  <p className={d.period}>{formatPeriod(e.period)}</p>
                  <p>{e.summary}</p>
                  {e.highlights.length > 0 && (
                    <ul className={d.bullets}>
                      {e.highlights.map((h) => (
                        <li key={h}>{h}</li>
                      ))}
                    </ul>
                  )}
                  {e.technologies.length > 0 && (
                    <ul className={d.chips} aria-label="Technologies">
                      {e.technologies.map((t) => (
                        <li key={t}>{t}</li>
                      ))}
                    </ul>
                  )}
                </article>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="projects-h" className={d.section}>
          <h2 id="projects-h" className={`${d.sectionSign} ${d.signProject}`}>
            Project highway
          </h2>
          <ol className={d.timeline}>
            {projects.map((p, i) => (
              <li key={p.id} className={d.stop}>
                <span className={`${d.year} ${d.exit}`} aria-hidden>
                  Exit {String(i + 1).padStart(2, "0")}
                </span>
                <article className={d.card}>
                  <h3 className={d.role}>{p.name}</h3>
                  <p className={d.org}>{p.tagline}</p>
                  <p>
                    <strong>Problem.</strong> {p.problem}
                  </p>
                  <p>
                    <strong>Role.</strong> {p.role}
                  </p>
                  <p className={d.arch}>
                    <strong>Architecture.</strong> {p.architecture.map((l) => `${l.label}: ${l.items.join(", ")}`).join(" → ")}
                  </p>
                  <ul className={d.bullets}>
                    {p.highlights.map((h) => (
                      <li key={h}>{h}</li>
                    ))}
                  </ul>
                  {p.outcome && (
                    <p>
                      <strong>Outcome.</strong> {p.outcome}
                    </p>
                  )}
                  <ul className={d.chips} aria-label="Technologies">
                    {p.technologies.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                  {p.url && (
                    <p>
                      <a href={p.url} rel="noreferrer">
                        View project ↗
                      </a>
                    </p>
                  )}
                </article>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="education-h" className={d.section}>
          <h2 id="education-h" className={`${d.sectionSign} ${d.signEducation}`}>
            Education road
          </h2>
          <ol className={d.timeline}>
            {education.map((e) => (
              <li key={e.id} className={d.stop}>
                <span className={d.year} aria-hidden>
                  {e.period.end?.slice(0, 4)}
                </span>
                <article className={d.card}>
                  <h3 className={d.role}>{e.degree}</h3>
                  <p className={d.org}>{e.institution}</p>
                  <p className={d.period}>{formatPeriod(e.period)}</p>
                  {e.major && <p>Major: {e.major}</p>}
                </article>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="tech-h" className={d.section}>
          <h2 id="tech-h" className={`${d.sectionSign} ${d.signInfo}`}>
            Technology district
          </h2>
          <div className={d.districts}>
            {skills.map((s) => (
              <div key={s.id} className={d.district}>
                <h3>{s.name}</h3>
                <ul className={d.chips}>
                  {s.items.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className={d.end} aria-labelledby="end-h">
        <p className={d.endSign} id="end-h">
          {closing.headline}
          <small>{closing.sub}</small>
        </p>
        <p className={d.statement}>{closing.statement}</p>
        <p className={d.links}>
          <a href={`mailto:${profile.email}`}>Contact me</a>
          <a href={profile.links.linkedin}>LinkedIn</a>
          <a href={profile.links.github}>GitHub</a>
        </p>
      </footer>
    </div>
  );
}
