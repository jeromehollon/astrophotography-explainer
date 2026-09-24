// Temporary stand-in for src/shared/ui (owner: foundation). Same prop contract as
// docs/contracts.md so the lesson pages swap to the shared components with an import change.
import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router';

const CHAPTERS: { label: string; path: string }[] = [
  { label: 'Welcome', path: '/welcome' },
  { label: 'Noise & Defects', path: '/noise' },
  { label: 'Calibration', path: '/calibration/bias' },
  { label: 'Alignment', path: '/alignment' },
  { label: 'Algorithms', path: '/algorithms' },
  { label: 'Light frames', path: '/light-frames' },
  { label: 'Workbench', path: '/workbench' },
];

// Wizard order (SPEC §7) with TopBar page labels and BottomNav titles.
const WIZARD: { path: string; chapter: string; page: string; title: string }[] = [
  { path: '/welcome', chapter: 'Welcome', page: 'Welcome', title: 'Welcome' },
  { path: '/noise', chapter: 'Noise & Defects', page: 'Noise & Defects', title: 'Noise & Defects' },
  { path: '/calibration/bias', chapter: 'Calibration', page: 'Bias', title: 'Bias' },
  { path: '/calibration/darks', chapter: 'Calibration', page: 'Darks', title: 'Darks' },
  { path: '/calibration/flats', chapter: 'Calibration', page: 'Flats', title: 'Flats' },
  { path: '/calibration/flats-2', chapter: 'Calibration', page: 'Flats, continued', title: 'Flats, continued' },
  { path: '/alignment', chapter: 'Alignment', page: 'Alignment', title: 'Alignment' },
  { path: '/algorithms', chapter: 'Algorithms', page: 'Algorithms', title: 'Algorithms' },
  { path: '/light-frames', chapter: 'Light frames', page: 'Image Worthiness', title: 'Light frames' },
  { path: '/light-frames/review', chapter: 'Light frames', page: 'Review the Exposures', title: 'Light frames, continued' },
  { path: '/workbench', chapter: 'Workbench', page: 'Workbench', title: 'Workbench' },
];

export function Logo({ size = 28 }: { size?: 24 | 28 | 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <ellipse cx="26" cy="27" rx="24" ry="8.5" transform="rotate(-22 26 27)" fill="#E0604B" />
      <ellipse cx="38" cy="37" rx="24" ry="8.5" transform="rotate(-22 38 37)" fill="#F2CE6B" />
      <ellipse cx="32" cy="32" rx="24" ry="8.5" transform="rotate(-22 32 32)" fill="#1F4AA8" />
      <circle cx="32" cy="32" r="4.5" fill="#F7F2EA" />
    </svg>
  );
}

function TopBar() {
  const { pathname } = useLocation();
  const current = WIZARD.find((w) => w.path === pathname) ?? WIZARD[0];
  const pages = WIZARD.filter((w) => w.chapter === current.chapter);
  return (
    <header className="w-[1440px] bg-surface-page">
      <div className="flex h-[64px] items-center gap-[64px] border-b-2 border-border-strong px-[120px]">
        <div className="flex items-center gap-[10px]">
          <Logo size={28} />
          <div className="flex flex-col whitespace-nowrap">
            <span className="font-heading text-[20px] leading-[22px] font-medium text-text-primary">Calibration &amp; Stacking</span>
            <span className="font-body text-[12px] leading-[14px] text-text-secondary">Astrophotography explained</span>
          </div>
        </div>
        <nav className="flex h-full items-start gap-[28px]">
          {CHAPTERS.map((c) => {
            const active = c.label === current.chapter;
            return (
              <Link key={c.label} to={c.path} className="flex h-[64px] flex-col justify-between pt-[22px] pb-[2px]">
                <span className={`font-body text-[14px] leading-[20px] font-medium whitespace-nowrap ${active ? 'text-text-primary' : 'text-text-link'}`}>{c.label}</span>
                <span className={`h-[3px] w-full ${active ? 'bg-accent-primary' : ''}`} />
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="flex h-[40px] items-start gap-[28px] border-b border-border-default bg-surface-panel px-[120px]">
        <span className="h-px w-[276px]" />
        {pages.map((p) => {
          const active = p.path === current.path;
          return (
            <Link key={p.path} to={p.path} className="flex h-[40px] flex-col justify-between pt-[11px]">
              <span className={`font-body text-[14px] leading-[20px] font-medium whitespace-nowrap ${active ? 'text-text-primary' : 'text-text-link'}`}>{p.page}</span>
              <span className={`h-[3px] w-full ${active ? 'bg-accent-primary' : ''}`} />
            </Link>
          );
        })}
      </div>
    </header>
  );
}

export function Button({ variant = 'primary', to, onClick, children, className = '' }: { variant?: 'primary' | 'secondary' | 'ghost'; to?: string; onClick?: () => void; children: ReactNode; className?: string }) {
  const base = 'inline-flex items-center justify-center gap-[8px] rounded-md px-[24px] py-[12px] font-body text-[14px] leading-[20px] font-medium whitespace-nowrap ' + className;
  const skin = variant === 'primary' ? 'bg-accent-primary text-text-on-accent hover:bg-accent-primary-hover' : variant === 'secondary' ? 'bg-surface-card text-text-primary border-2 border-border-strong' : 'text-text-link';
  if (to) return <Link to={to} className={`${base} ${skin}`}>{children}</Link>;
  return <button type="button" onClick={onClick} className={`${base} ${skin}`}>{children}</button>;
}

function BottomNav() {
  const { pathname } = useLocation();
  const i = WIZARD.findIndex((w) => w.path === pathname);
  const prev = i > 0 ? WIZARD[i - 1] : null;
  const next = i >= 0 && i < WIZARD.length - 1 ? WIZARD[i + 1] : null;
  return (
    <footer className="flex h-[88px] w-[1440px] items-center justify-between border-t border-border-default bg-surface-page px-[120px]">
      {prev ? <Button variant="secondary" to={prev.path}>← {prev.title}</Button> : <span />}
      {next ? <Button to={next.path}>{i === 0 ? `Start: ${next.title} →` : `${next.title} →`}</Button> : <span />}
    </footer>
  );
}

export function LessonPage({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen w-[1440px] flex-col items-start bg-surface-page">
      <TopBar />
      <main className="w-full grow">{children}</main>
      <BottomNav />
    </div>
  );
}

export function Reading({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`flex w-full flex-col items-start gap-[32px] px-[120px] py-[64px] ${className}`}>{children}</div>;
}

export function PageHead({ eyebrow, title, subtitle, lede }: { eyebrow: string; title: string; subtitle?: string; lede: string }) {
  return (
    <div className="flex flex-col items-start gap-[12px]">
      <p className="eyebrow text-text-link">{eyebrow}</p>
      <h1 className="w-[900px] font-heading text-[40px] leading-[46px] font-semibold tracking-[-0.5px] text-text-primary">{title}</h1>
      {subtitle && <p className="w-[900px] font-heading text-[24px] leading-[32px] font-medium tracking-[-0.5px] text-text-secondary">{subtitle}</p>}
      <p className="w-[680px] font-body text-[18px] leading-[28px] text-text-secondary">{lede}</p>
    </div>
  );
}

/** 680 px reading column. h2 = heading/h2, p = body/md, gap 24. */
export function Prose({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`prose-col flex w-[680px] flex-col items-start gap-[24px] text-text-primary ${className}`}>{children}</div>;
}

export function Callout({ kind, title, children, className = '' }: { kind: 'note' | 'why' | 'caution'; title: string; children: ReactNode; className?: string }) {
  const skin = kind === 'note' ? 'bg-surface-panel border-l-4 border-accent-primary' : kind === 'why' ? 'bg-surface-card border border-border-strong' : 'bg-surface-panel border-l-4 border-red-600';
  const word = kind === 'note' ? 'Note' : kind === 'why' ? 'Why?' : 'Careful';
  const wordColor = kind === 'why' ? 'text-text-link' : 'text-text-secondary';
  return (
    <aside className={`flex flex-col items-start gap-[8px] px-[24px] py-[16px] ${skin} ${className}`}>
      <p className={`eyebrow ${wordColor}`}>{word}</p>
      <p className="w-full font-body text-[14px] leading-[20px] font-medium text-text-primary">{title}</p>
      <div className="w-full font-body text-[14px] leading-[20px] text-text-primary whitespace-pre-line">{children}</div>
    </aside>
  );
}

type Source = 'bias' | 'dark' | 'flat' | 'noise' | 'external';
const BADGE: Record<Source, { label: string; bg: string; border: string; glyph: ReactNode }> = {
  bias: { label: 'Bias', bg: 'bg-source-bias-soft', border: 'border-source-bias', glyph: <svg width="12" height="12" viewBox="0 0 12 12"><circle cx="6" cy="6" r="6" fill="#1F4AA8" /></svg> },
  dark: { label: 'Dark', bg: 'bg-source-dark-soft', border: 'border-source-dark', glyph: <svg width="12" height="12" viewBox="0 0 12 12"><rect width="12" height="12" fill="#C8321F" /></svg> },
  flat: { label: 'Flat', bg: 'bg-source-flat-soft', border: 'border-source-flat', glyph: <svg width="13" height="12" viewBox="0 0 13 12"><path d="M6.5 0L12.13 9H0.87L6.5 0Z" fill="#E3A81E" /></svg> },
  noise: { label: 'Random noise', bg: 'bg-source-noise-soft', border: 'border-source-noise', glyph: <svg width="12" height="12" viewBox="0 0 12 12"><path d="M6 0L12 6L6 12L0 6L6 0Z" fill="#8B8B8B" /></svg> },
  external: { label: 'Outside the camera', bg: 'bg-source-external-soft', border: 'border-source-external', glyph: <svg width="12" height="12" viewBox="0 0 12 12"><path d="M6 0L11.7 4.15L9.53 10.85H2.47L0.29 4.15L6 0Z" fill="#6B3FA0" /></svg> },
};
export function Badge({ source }: { source: Source }) {
  const b = BADGE[source];
  return (
    <span className={`inline-flex items-center gap-[8px] rounded-sm border px-[8px] py-[4px] ${b.bg} ${b.border}`}>
      <span className="flex size-[12px] items-center justify-center">{b.glyph}</span>
      <span className="font-body text-[12px] leading-[16px] font-medium tracking-[0.2px] whitespace-nowrap text-text-primary">{b.label}</span>
    </span>
  );
}
