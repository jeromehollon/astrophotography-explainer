// Local stand-ins for the shared UI (src/shared/ui, owner: foundation) so this
// section can be built before that lands. Every measurement comes from the Figma
// library components (TopBar 17:1087, BottomNav 11:28, Toggle 9:117, Chip 9:130,
// ROITile 9:337, Callout 9:210). Swap these imports for src/shared/ui once it is
// on main; the prop names follow docs/contracts.md so the swap is mechanical.
import type { ReactNode } from 'react';
import { Link } from 'react-router';

const chapters: { label: string; path: string }[] = [
  { label: 'Welcome', path: '/welcome' },
  { label: 'Noise & Defects', path: '/noise' },
  { label: 'Calibration', path: '/calibration/bias' },
  { label: 'Alignment', path: '/alignment' },
  { label: 'Algorithms', path: '/algorithms' },
  { label: 'Light frames', path: '/light-frames' },
  { label: 'Workbench', path: '/workbench' },
];

const calibrationPages: { label: string; path: string }[] = [
  { label: 'Bias', path: '/calibration/bias' },
  { label: 'Darks', path: '/calibration/darks' },
  { label: 'Flats', path: '/calibration/flats' },
  { label: 'Flats, continued', path: '/calibration/flats-2' },
];

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true" className="block shrink-0">
      <ellipse cx="26" cy="27" rx="24" ry="8.5" transform="rotate(-22 26 27)" fill="#E0604B" />
      <ellipse cx="38" cy="37" rx="24" ry="8.5" transform="rotate(-22 38 37)" fill="#F2CE6B" />
      <ellipse cx="32" cy="32" rx="24" ry="8.5" transform="rotate(-22 32 32)" fill="#1F4AA8" />
      <circle cx="32" cy="32" r="4.5" fill="#F7F2EA" />
    </svg>
  );
}

export function TopBar({ chapter, page }: { chapter: string; page: string }) {
  return (
    <header className="w-[1440px] bg-surface-page">
      <div className="flex h-[64px] w-[1440px] items-center gap-[64px] border-b-2 border-border-strong bg-surface-page px-[120px]">
        <div className="flex items-center gap-[10px]">
          <Logo size={28} />
          <div className="flex flex-col items-start whitespace-nowrap">
            <p className="font-heading text-[20px] leading-[22px] font-medium text-text-primary">Calibration &amp; Stacking</p>
            <p className="font-body text-[12px] leading-[14px] text-text-secondary">Astrophotography explained</p>
          </div>
        </div>
        <nav className="flex h-full items-start gap-[28px]">
          {chapters.map((c) => {
            const current = c.label === chapter;
            return (
              <Link key={c.label} to={c.path} className="flex h-[64px] flex-col items-start justify-between pt-[22px] pb-[2px]">
                <span className={`font-body text-[14px] leading-[20px] font-medium whitespace-nowrap ${current ? 'text-text-primary' : 'text-text-link'}`}>{c.label}</span>
                <span className={`h-[3px] w-full ${current ? 'bg-accent-primary' : ''}`} />
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="flex h-[40px] w-[1440px] items-start gap-[28px] border-b border-border-default bg-surface-panel px-[120px]">
        <span className="h-px w-[276px]" />
        {calibrationPages.map((p) => {
          const current = p.label === page;
          return (
            <Link key={p.label} to={p.path} className="flex h-[40px] flex-col items-start justify-between pt-[11px]">
              <span className={`font-body text-[14px] leading-[20px] font-medium whitespace-nowrap ${current ? 'text-text-primary' : 'text-text-link'}`}>{p.label}</span>
              <span className={`h-[3px] w-full ${current ? 'bg-accent-primary' : ''}`} />
            </Link>
          );
        })}
      </div>
    </header>
  );
}

export function BottomNav({ prev, next }: { prev: { label: string; path: string }; next: { label: string; path: string } }) {
  return (
    <nav className="flex h-[88px] w-[1440px] items-center justify-between border-t border-border-default bg-surface-page px-[120px]">
      <Link to={prev.path} className="flex items-center justify-center gap-[8px] rounded-md border-2 border-border-strong bg-surface-card px-[24px] py-[12px] font-body text-[14px] leading-[20px] font-medium whitespace-nowrap text-text-primary">
        {prev.label}
      </Link>
      <Link to={next.path} className="flex items-center justify-center gap-[8px] rounded-md bg-accent-primary px-[24px] py-[12px] font-body text-[14px] leading-[20px] font-medium whitespace-nowrap text-text-on-accent">
        {next.label}
      </Link>
    </nav>
  );
}

export function LessonPage({ chapter, page, prev, next, children }: {
  chapter: string; page: string;
  prev: { label: string; path: string }; next: { label: string; path: string };
  children: ReactNode;
}) {
  return (
    <div className="flex w-[1440px] flex-col items-start bg-surface-page">
      <TopBar chapter={chapter} page={page} />
      <main className="flex w-full flex-col items-start">{children}</main>
      <BottomNav prev={prev} next={next} />
    </div>
  );
}

export function Reading({ children }: { children: ReactNode }) {
  return <div className="flex w-full flex-col items-start gap-[32px] px-[120px] py-[64px]">{children}</div>;
}

export function PageHead({ eyebrow, title, lede }: { eyebrow: string; title: string; lede: string }) {
  return (
    <div className="flex flex-col items-start gap-[12px]">
      <p className="font-heading text-[13px] leading-[16px] font-medium tracking-[1.5px] uppercase whitespace-nowrap text-text-link">{eyebrow}</p>
      <h1 className="w-[900px] font-heading text-[40px] leading-[46px] font-semibold tracking-[-0.5px] text-text-primary">{title}</h1>
      <p className="w-[680px] font-body text-[18px] leading-[28px] text-text-secondary">{lede}</p>
    </div>
  );
}

export function H2({ children }: { children: ReactNode }) {
  return <h2 className="w-[680px] font-heading text-[28px] leading-[34px] font-semibold text-text-primary">{children}</h2>;
}

export function P({ children, className = 'w-[680px]' }: { children: ReactNode; className?: string }) {
  return <p className={`font-body text-[16px] leading-[24px] text-text-primary ${className}`}>{children}</p>;
}

export function Rule() {
  return <div className="h-[6px] w-[1440px] bg-ink-900" />;
}

export function Stage({ children }: { children: ReactNode }) {
  return <section className="flex w-full flex-col items-start gap-[40px] bg-surface-stage px-[120px] py-[48px]">{children}</section>;
}

export function StageHead({ eyebrow, title, instructions }: { eyebrow: string; title: string; instructions: string }) {
  return (
    <div className="flex flex-col items-start gap-[12px]">
      <p className="font-heading text-[13px] leading-[16px] font-medium tracking-[1.5px] uppercase whitespace-nowrap text-text-on-stage-muted">{eyebrow}</p>
      <h2 className="w-[900px] font-heading text-[28px] leading-[34px] font-semibold text-text-on-stage">{title}</h2>
      <p className="w-[680px] font-body text-[16px] leading-[24px] text-text-on-stage-muted">{instructions}</p>
    </div>
  );
}

export function Experiment({ title, help, controls, children }: { title: string; help: string; controls: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-[16px]">
      <div className="flex items-center gap-[24px]">
        <h3 className="font-heading text-[22px] leading-[28px] font-medium whitespace-nowrap text-text-on-stage">{title}</h3>
        {controls}
        <p className="w-[360px] font-body text-[14px] leading-[20px] text-text-on-stage-muted">{help}</p>
      </div>
      <div className="flex items-start gap-[24px]">{children}</div>
    </div>
  );
}

export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex items-center gap-[12px] focus-visible:outline-3 focus-visible:outline-accent-focus-on-stage"
    >
      <svg width="44" height="24" viewBox="0 0 44 24" fill="none" aria-hidden="true" className="block shrink-0">
        <rect x="1" y="1" width="42" height="22" rx="11" fill={checked ? '#1F4AA8' : '#F7F2EA'} stroke="#1C1A17" strokeWidth="2" />
        <circle cx={checked ? 32 : 12} cy="12" r="7" fill={checked ? '#F7F2EA' : '#1C1A17'} />
      </svg>
      <span className="font-body text-[14px] leading-[20px] font-medium whitespace-nowrap text-text-on-stage">{label}</span>
    </button>
  );
}

export function Chip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={`flex items-center justify-center rounded-[999px] border-[1.5px] px-[16px] py-[8px] font-body text-[14px] leading-[20px] font-medium whitespace-nowrap focus-visible:outline-3 focus-visible:outline-accent-focus-on-stage ${
        selected ? 'border-accent-primary bg-accent-primary text-text-on-accent' : 'border-border-strong bg-surface-card text-text-primary'
      }`}
    >
      {children}
    </button>
  );
}

export function ChipGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex items-start gap-[8px]">
      {children}
    </div>
  );
}

export function ROITile({ title, caption, src, alt }: { title: string; caption: string; src: string; alt: string }) {
  return (
    <figure className="flex w-[320px] flex-col items-start border border-border-on-stage bg-surface-stage-raised">
      <div className="flex w-full items-center px-[12px] py-[10px]">
        <p className="font-body text-[14px] leading-[20px] font-medium whitespace-nowrap text-text-on-stage">{title}</p>
      </div>
      <div className="h-[240px] w-full overflow-hidden">
        <img src={src} alt={alt} width={320} height={240} className="block h-full w-full object-cover" />
      </div>
      <figcaption className="flex w-full flex-col items-start px-[12px] py-[10px]">
        <p className="w-full font-body text-[14px] leading-[20px] text-text-on-stage-muted">{caption}</p>
      </figcaption>
    </figure>
  );
}

export function Callout({ kind, title, children }: { kind: 'note' | 'why'; title: string; children: ReactNode }) {
  const why = kind === 'why';
  return (
    <aside
      className={`flex w-[680px] flex-col items-start gap-[8px] px-[24px] py-[16px] ${
        why ? 'border border-border-strong bg-surface-card' : 'border-l-4 border-accent-primary bg-surface-panel'
      }`}
    >
      <p className={`font-heading text-[13px] leading-[16px] font-medium tracking-[1.5px] uppercase whitespace-nowrap ${why ? 'text-text-link' : 'text-text-secondary'}`}>
        {why ? 'Why?' : 'Note'}
      </p>
      <p className="w-full font-body text-[14px] leading-[20px] font-medium text-text-primary">{title}</p>
      <p className="w-full font-body text-[14px] leading-[20px] text-text-primary">{children}</p>
    </aside>
  );
}
