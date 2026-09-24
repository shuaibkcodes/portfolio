/**
 * Single source of truth for every piece of portfolio content.
 *
 * The 3D world, the GPS, the dashboard, the detail panels and the semantic
 * (SEO / fallback) document all read from here. World geometry lives in
 * `src/world/` and only references content by id.
 *
 * Sources:
 *   [GH]  github.com/meShuaibKhalid — profile README + repositories
 *   [LI]  LinkedIn (public search snippets; the profile itself blocks automated access)
 *   [WEB] burjsoft.com
 *
 * Anything marked `VERIFY` came from a secondary source or conflicts between
 * sources. Confirm or correct it here — nothing else needs to change.
 */

export type YearMonth = `${number}-${string}`; // "2021-08"

export interface Period {
  start?: YearMonth;
  /** Omit for "present". */
  end?: YearMonth;
}

export interface Profile {
  name: string;
  title: string;
  discipline: string;
  summary: string;
  location: string;
  email: string;
  links: { linkedin: string; github: string };
  /** Put a PDF in /public and set this to e.g. "/resume.pdf" to enable the Download Resume button. */
  resumeUrl?: string;
}

export interface ExperienceEntry {
  id: string;
  company: string;
  companyBlurb?: string;
  role: string;
  period: Period;
  location?: string;
  summary: string;
  highlights: string[];
  technologies: string[];
  /** Short labels rendered as roadside signs after the station (keep to ~3 words each, max 4 tags). */
  signTags: string[];
}

export interface EducationEntry {
  id: string;
  institution: string;
  degree: string;
  major?: string;
  period: Period;
  highlights: string[];
  signTags: string[];
}

export interface ArchitectureLayer {
  label: string;
  items: string[];
}

export interface Project {
  id: string;
  name: string;
  tagline: string;
  /** Short line for the roadside destination sign. */
  signTagline?: string;
  url?: string;
  repo?: string;
  problem: string;
  role: string;
  architecture: ArchitectureLayer[];
  technologies: string[];
  challenges: string[];
  highlights: string[];
  outcome?: string;
}

export interface SkillDistrict {
  id: string;
  name: string;
  items: string[];
}

export const profile: Profile = {
  name: "Muhammad Shuaib Khalid",
  title: "Lead Software Engineer", // VERIFY: [LI] snippets show "Web Development Team Lead"
  discipline: "Full-Stack Software Engineering",
  summary:
    "Full-stack engineer building scalable web and mobile applications with TypeScript, Angular, React, Node.js and NestJS — focused on performance, scalable architecture and clean code.", // [GH] README
  location: "Multan, Pakistan", // [GH] "Pakistan", [LI] Multan
  email: "khalidshuaib07@gmail.com", // [GH] README
  links: {
    linkedin: "https://www.linkedin.com/in/shuaibkhalid/",
    github: "https://github.com/meShuaibKhalid",
  },
  resumeUrl: undefined,
};

/** Chronological, oldest first. */
export const experience: ExperienceEntry[] = [
  {
    id: "noor-it",
    company: "Noor IT Solutions",
    role: "Web Developer",
    period: { start: "2019-12", end: "2021-07" }, // [LI]
    summary: "First professional role — building for the web.",
    highlights: [], // TODO: add responsibilities/achievements
    technologies: [], // TODO
    signTags: [],
  },
  {
    id: "burjsoft-mean",
    company: "BurjSoft",
    companyBlurb: "Custom software for engineering, logistics, fintech & real estate", // [WEB]
    role: "MEAN Stack Developer",
    period: { start: "2021-08", end: "2024-03" }, // [LI]
    location: "Multan, Pakistan",
    summary: "Developed and maintained web applications across the MEAN stack.", // [LI]
    highlights: [
      "Developed and maintained web applications with MongoDB, Express.js, Angular and Node.js", // [LI]
      "Built responsive, user-friendly interfaces", // [LI]
    ],
    technologies: ["MongoDB", "Express.js", "Angular", "Node.js", "TypeScript"],
    signTags: ["MongoDB", "Express.js", "Angular", "Node.js"],
  },
  {
    id: "burjsoft-lead",
    company: "BurjSoft",
    companyBlurb: "Custom software for engineering, logistics, fintech & real estate", // [WEB]
    role: "Lead Software Engineer", // VERIFY: [LI] "Web Development Team Lead"
    period: { start: "2024-04" }, // VERIFY: inferred from previous role ending 2024-03
    location: "Multan, Pakistan",
    summary: "Promoted to lead web development at BurjSoft.", // [LI]
    highlights: [
      "Leads the web development team", // [LI]
      "Owns architecture and delivery of full-stack products", // VERIFY
    ],
    technologies: ["Angular", "React", "Node.js", "NestJS", "TypeScript", "Docker", "AWS"], // [GH] README stack
    signTags: ["Team Leadership", "System Architecture", "Full-Stack", "Performance"], // VERIFY
  },
];

export const education: EducationEntry[] = [
  {
    id: "uoe",
    institution: "University of Education",
    degree: "BS Information Technology", // VERIFY: [GH] README says "Bachelor of Computer Sciences"
    major: "Artificial Intelligence", // VERIFY: [LI] snippet
    period: { end: "2021-06" }, // [LI] graduated 2021 — VERIFY month; add `start`
    highlights: [],
    signTags: ["Information Technology", "Artificial Intelligence", "Class of 2021"],
  },
];

export const projects: Project[] = [
  {
    id: "rotormaps",
    name: "Rotormaps",
    tagline: "Orthophotos and real-time power plant insights",
    signTagline: "Orthophotos & power plant insights",
    url: "https://rotormaps.app", // VERIFY: domain did not resolve when checked (Sep 2026)
    problem:
      "Aerial imagery of power plant sites is only useful once it becomes an accurate, shareable map. Rotormaps turns uploaded imagery into orthophotos and real-time insights on the web.",
    role: "Designed the full system architecture and built the UI from scratch.",
    architecture: [
      { label: "Client", items: ["React", "Leaflet map viewer"] },
      { label: "API", items: ["Node.js", "OAuth + role-based access", "Stripe"] },
      { label: "Processing", items: ["NodeODM", "Docker containers"] },
      { label: "Data", items: ["MongoDB", "AWS S3"] },
      { label: "Realtime", items: ["WebSockets"] },
    ],
    technologies: ["React", "Node.js", "MongoDB", "NodeODM", "Docker", "Stripe", "OAuth", "Leaflet", "AWS S3"],
    challenges: [
      "Running photogrammetry processing (NodeODM) reliably in Docker containers",
      "Encrypting sensitive site imagery",
      "Pushing real-time updates to clients over WebSockets",
      "Role-based access control alongside Stripe payments",
    ],
    highlights: [
      "Full system architecture and UI from scratch",
      "Stripe integration and role-based access control",
      "Built Docker containers and real-time WebSockets",
      "Developed image encryption and third-party integrations",
    ],
    outcome: undefined, // TODO: users, sites processed, performance numbers…
  },
  {
    id: "zlivio",
    name: "Zlivio CRM",
    tagline: "Real estate CRM for brokers, properties, marketing and investments",
    signTagline: "Real estate CRM",
    url: "https://zlivio.com",
    problem: "Brokers needed one place to manage properties, marketing and investments.", // VERIFY: inferred from description
    role: "Designed the database, built REST APIs and integrations.", // VERIFY: inferred from highlights
    architecture: [
      { label: "Client", items: ["React", "TailwindCSS"] },
      { label: "API", items: ["NestJS", "Hasura", "GraphQL", "REST"] },
      { label: "Data", items: ["SQL Server", "Redis", "AWS S3"] },
      { label: "Integrations", items: ["Twilio", "SendGrid", "OAuth"] },
    ],
    technologies: ["React", "NestJS", "Redis", "Hasura", "GraphQL", "SQL Server", "TailwindCSS", "AWS S3", "Twilio", "SendGrid"],
    challenges: [],
    highlights: [
      "Designed and structured the database",
      "Integrated Twilio and SendGrid APIs",
      "Implemented OAuth logins and AWS S3 uploads",
      "Built REST APIs and optimized performance",
    ],
  },
  {
    id: "rapaydo",
    name: "Rapaydo",
    tagline: "Licensed financial service platform — e-commerce and virtual POS",
    signTagline: "E-commerce & virtual POS",
    url: "https://rapaydo.com",
    problem: "Merchants needed online payments and a virtual point of sale.", // VERIFY: inferred from description
    role: "Front-end development, payments integration and build automation.", // VERIFY: inferred from highlights
    architecture: [{ label: "Client", items: ["Angular", "Gulp.js"] }, { label: "Payments", items: ["Stripe"] }, { label: "Quality", items: ["SonarCloud"] }],
    technologies: ["Angular", "JavaScript", "Gulp.js", "Stripe", "SonarCloud"],
    challenges: [],
    highlights: [
      "Integrated Stripe payment gateways and merchant dashboards",
      "Cross-browser responsive designs",
      "Automated builds and code quality analysis with SonarCloud",
    ],
  },
  {
    id: "terranai",
    name: "TerranAi",
    tagline: "A researcher's discovery tool powered by AI",
    signTagline: "AI discovery for researchers",
    url: "https://info.terran.ai",
    problem: "Researchers needed to explore large result sets quickly.", // VERIFY: inferred from highlights
    role: "Front-end performance and component work.", // VERIFY: inferred from highlights
    architecture: [{ label: "Client", items: ["React", "Material UI"] }],
    technologies: ["React", "Material UI", "GitLab"],
    challenges: [],
    highlights: ["Optimized UI performance and virtual scrolling", "Built dynamic filters and reusable components"],
  },
  {
    id: "water-reminder",
    name: "Water Reminder App",
    tagline: "Cross-platform app that helps users stay hydrated with reminders",
    signTagline: "Hydration reminders",
    problem: "People forget to drink enough water through the day.", // VERIFY: inferred from description
    role: "UI/UX design and full-stack development for Android and iOS.", // VERIFY: inferred from highlights + stack
    architecture: [
      { label: "App", items: ["Angular", "Capacitor"] },
      { label: "API", items: ["Node.js", "Firebase"] },
      { label: "Data", items: ["MongoDB"] },
    ],
    technologies: ["Angular", "Node.js", "MongoDB", "Highcharts", "Capacitor", "Firebase"],
    challenges: [],
    highlights: [
      "Designed UI/UX for Android/iOS",
      "Implemented push/local notifications",
      "Real-time data with infinite scrolling and charts",
    ],
  },
];

/** [GH] README tech stack, grouped into districts. */
export const skills: SkillDistrict[] = [
  { id: "frontend", name: "Frontend", items: ["TypeScript", "JavaScript", "Angular", "React", "Next.js", "Vue.js", "RxJS", "NgRx", "Redux", "Ionic", "Capacitor"] },
  { id: "backend", name: "Backend", items: ["Node.js", "NestJS", "Express.js", "LoopBack", "GraphQL", "Socket.io", "WebRTC", "Microservices"] },
  { id: "data", name: "Data", items: ["MongoDB", "PostgreSQL", "MySQL", "MariaDB", "SQL Server", "Redis", "Prisma", "Mongoose"] },
  { id: "devops", name: "DevOps & Cloud", items: ["Docker", "AWS", "Firebase", "SonarCloud"] },
  { id: "geo", name: "Maps & Visualisation", items: ["Leaflet", "OpenLayers", "Google Maps", "Highcharts", "Chart.js"] },
];

export const closing = {
  headline: "End of the road",
  sub: "For now.",
  statement: "The road doesn't end here. I'm still building what's next.",
};

// ---------------------------------------------------------------------------

export const experienceById = Object.fromEntries(experience.map((e) => [e.id, e]));
export const educationById = Object.fromEntries(education.map((e) => [e.id, e]));
export const projectById = Object.fromEntries(projects.map((p) => [p.id, p]));

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatYearMonth(ym?: YearMonth): string {
  if (!ym) return "";
  const [y, m] = ym.split("-");
  const month = MONTHS[Number(m) - 1];
  return month ? `${month} ${y}` : y;
}

export function formatPeriod(p: Period): string {
  if (!p.start && p.end) return `Graduated ${p.end.slice(0, 4)}`;
  return `${formatYearMonth(p.start)} — ${p.end ? formatYearMonth(p.end) : "Present"}`;
}
