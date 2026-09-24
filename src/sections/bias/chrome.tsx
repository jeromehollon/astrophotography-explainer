// Temporary stand-ins for the Foundation shared UI (src/shared/ui), built from the Figma
// TopBar 17:1087, BottomNav 11:28, Toggle 9:117, ROITile 9:337 and Callout 9:210.
// Replace with imports from '../../shared/ui' once Foundation lands on main.
import type { ReactNode } from 'react';
import { Link } from 'react-router';

const CHAPTERS: { label: string; path: string }[] = [
  { label: 'Welcome', path: '/welcome' },
  { label: 'Noise & Defects', path: '/noise' },
  { label: 'Calibration', path: '/calibration/bias' },
  { label: 'Alignment', path: '/alignment' },
  { label: 'Algorithms', path: '/algorithms' },
  { label: 'Light frames', path: '/light-frames' },
  { label: 'Workbench', path: '/workbench' },
];
const CALIBRATION_PAGES: { label: string; path: string }[] = [
  { label: 'Bias', path: '/calibration/bias' },
  { label: 'Darks', path: '/calibration/darks' },
  { label: 'Flats', path: '/calibration/flats' },
  { label: 'Flats, continued', path: '/calibration/flats-2' },
];

function Logo() {
  return (
    <svg width="28" height="28" viewBox="0 0 64 64" fill="none" aria-hidden="true">
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
      <div className="flex h-[64px] items-center gap-[64px] border-b-2 border-border-strong px-[120px]">
        <div className="flex items-center gap-[10px]">
          <Logo />
          <div className="flex flex-col whitespace-nowrap">
            <span className="font-heading text-[20px] leading-[22px] font-medium text-text-primary">Calibration &amp; Stacking</span>
            <span className="font-body text-[12px] leading-[14px] text-text-secondary">Astrophotography explained</span>
          </div>
        </div>
        <nav className="flex h-full items-start gap-[28px]">
          {CHAPTERS.map((c) => {
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
      <div className="flex h-[40px] items-start gap-[28px] border-b border-border-default bg-surface-panel px-[120px]">
        <span className="h-px w-[276px]" />
        {CALIBRATION_PAGES.map((p) => {
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
    <footer className="flex h-[88px] w-[1440px] items-center justify-between border-t border-border-default bg-surface-page px-[120px]">
      <Link to={prev.path} className="flex items-center justify-center gap-[8px] rounded-md border-2 border-border-strong bg-surface-card px-[24px] py-[12px] font-body text-[14px] leading-[20px] font-medium whitespace-nowrap text-text-primary">
        ← {prev.label}
      </Link>
      <Link to={next.path} className="flex items-center justify-center gap-[8px] rounded-md bg-accent-primary px-[24px] py-[12px] font-body text-[14px] leading-[20px] font-medium whitespace-nowrap text-text-on-accent">
        {next.label} →
      </Link>
    </footer>
  );
}

export function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex items-center gap-[12px] focus-visible:outline-none group"
    >
      <span className="relative block h-[24px] w-[44px] rounded-full group-focus-visible:outline-3 group-focus-visible:outline-offset-2 group-focus-visible:outline-accent-focus-on-stage">
        <svg width="44" height="24" viewBox="0 0 44 24" fill="none" aria-hidden="true" className="block">
          <rect x="1" y="1" width="42" height="22" rx="11" fill={checked ? '#1F4AA8' : '#F7F2EA'} stroke="#1C1A17" strokeWidth="2" />
          <circle cx={checked ? 32 : 12} cy="12" r="7" fill={checked ? '#F7F2EA' : '#1C1A17'} />
        </svg>
      </span>
      <span className="font-body text-[14px] leading-[20px] font-medium whitespace-nowrap text-text-on-stage">{label}</span>
    </button>
  );
}

export function ROITile({ title, caption, well, children }: { title: string; caption: string; well?: { w: number; h: number }; children: ReactNode }) {
  const size = well ?? { w: 318, h: 240 };
  return (
    <div className="flex w-[320px] flex-col border border-border-on-stage bg-surface-stage-raised">
      <div className="flex w-full items-center px-[12px] py-[10px]">
        <span className="font-body text-[14px] leading-[20px] font-medium whitespace-nowrap text-text-on-stage">{title}</span>
      </div>
      <div className="relative overflow-hidden" style={{ width: size.w, height: size.h }}>{children}</div>
      <div className="flex w-full flex-col px-[12px] py-[10px]">
        <p className="w-full font-body text-[14px] leading-[20px] text-text-on-stage-muted">{caption}</p>
      </div>
    </div>
  );
}

export function Callout({ title, children }: { title: string; children: ReactNode }) {
  return (
    <aside className="flex w-[440px] flex-col gap-[8px] border border-border-strong bg-surface-card px-[24px] py-[16px]">
      <p className="font-heading text-[13px] leading-[16px] font-medium tracking-[1.5px] uppercase text-text-link">Why?</p>
      <p className="font-body text-[14px] leading-[20px] font-medium text-text-primary">{title}</p>
      <p className="font-body text-[14px] leading-[20px] text-text-primary">{children}</p>
    </aside>
  );
}

export function Eyebrow({ children, onStage, dark }: { children: ReactNode; onStage?: boolean; dark?: boolean }) {
  const color = onStage ? 'text-text-on-stage-muted' : dark ? 'text-text-primary' : 'text-text-link';
  return <p className={`font-heading text-[13px] leading-[16px] font-medium tracking-[1.5px] uppercase whitespace-nowrap ${color}`}>{children}</p>;
}
