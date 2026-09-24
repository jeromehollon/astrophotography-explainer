// Temporary stand-ins for src/shared/ui (owner: foundation), built from the Figma
// TopBar 84:3, BottomNav 84:67, Chip 9:130, ROITile 9:337 and Callout 9:210 on the
// Algorithms page. Same prop names as docs/contracts.md so the page can switch to
// the shared components with an import change.
import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import { sections } from '../../../shell/sections';
import logoMark from './logo-mark.svg';

const chapters = ['Welcome', 'Noise & Defects', 'Calibration', 'Alignment', 'Algorithms', 'Light frames', 'Workbench'];

function TopBar() {
  const { pathname } = useLocation();
  const current = sections.find((s) => s.path === pathname);
  const chapterOf = (name: string) => sections.find((s) => s.chapter === name);
  const pages = sections.filter((s) => s.chapter === current?.chapter);
  return (
    <header className="flex w-[1440px] flex-col bg-surface-page">
      <div className="flex h-[64px] w-[1440px] items-center gap-[64px] border-b-2 border-border-strong px-[120px]">
        <div className="flex items-center gap-[10px]">
          <img src={logoMark} alt="" width={28} height={28} className="block size-[28px]" />
          <div className="flex flex-col whitespace-nowrap">
            <p className="font-heading text-[20px] font-medium leading-[22px] text-text-primary">Calibration &amp; Stacking</p>
            <p className="font-body text-[12px] leading-[14px] text-text-secondary">Astrophotography explained</p>
          </div>
        </div>
        <nav className="flex h-full items-start gap-[28px]">
          {chapters.map((name) => {
            const target = chapterOf(name);
            const active = current?.chapter === name;
            return (
              <Link
                key={name}
                to={target?.path ?? '#'}
                className="flex h-[64px] flex-col items-start justify-between pb-[2px] pt-[22px]"
              >
                <span
                  className={`whitespace-nowrap font-body text-[14px] font-medium leading-[20px] ${active ? 'text-text-primary' : 'text-text-link'}`}
                >
                  {name}
                </span>
                <span className={`h-[3px] w-full ${active ? 'bg-accent-primary' : ''}`} />
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="flex h-[40px] w-[1440px] items-start gap-[28px] border-b border-border-default bg-surface-panel px-[120px]">
        <div className="h-px w-[276px]" />
        {(pages.length ? pages : current ? [current] : []).map((s) => {
          const active = s.path === current?.path;
          const label = s.page || s.chapter;
          return (
            <Link key={s.path} to={s.path} className="flex h-[40px] flex-col items-start justify-between pt-[11px]">
              <span
                className={`whitespace-nowrap font-body text-[14px] font-medium leading-[20px] ${active ? 'text-text-primary' : 'text-text-link'}`}
              >
                {label}
              </span>
              <span className={`h-[3px] w-full ${active ? 'bg-accent-primary' : ''}`} />
            </Link>
          );
        })}
      </div>
    </header>
  );
}

function BottomNav() {
  const { pathname } = useLocation();
  const i = sections.findIndex((s) => s.path === pathname);
  const prev = i > 0 ? sections[i - 1] : undefined;
  const next = i >= 0 && i < sections.length - 1 ? sections[i + 1] : undefined;
  const label = (s: { chapter: string; page: string }) => (s.page ? `${s.chapter}, ${s.page}` : s.chapter);
  return (
    <footer className="flex h-[88px] w-[1440px] items-center justify-between border-t border-border-default bg-surface-page px-[120px]">
      {prev ? (
        <Link
          to={prev.path}
          className="flex items-center justify-center gap-[8px] rounded-md border-2 border-border-strong bg-surface-card px-[24px] py-[12px] font-body text-[14px] font-medium leading-[20px] text-text-primary"
        >
          ← {label(prev)}
        </Link>
      ) : (
        <span />
      )}
      {next ? (
        <Link
          to={next.path}
          className="flex items-center justify-center gap-[8px] rounded-md bg-accent-primary px-[24px] py-[12px] font-body text-[14px] font-medium leading-[20px] text-text-on-accent"
        >
          {label(next)} →
        </Link>
      ) : (
        <span />
      )}
    </footer>
  );
}

export function LessonPage({ children }: { children: ReactNode }) {
  return (
    <div className="w-[1440px] bg-surface-page">
      <TopBar />
      <main>{children}</main>
      <BottomNav />
    </div>
  );
}

export function Chip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={`flex items-center justify-center rounded-[999px] border-[1.5px] px-[16px] py-[8px] font-body text-[14px] font-medium leading-[20px] whitespace-nowrap ${
        selected ? 'border-accent-primary bg-accent-primary text-text-on-accent' : 'border-border-strong bg-surface-card text-text-primary'
      }`}
    >
      {children}
    </button>
  );
}

export function ChipGroup({ children }: { children: ReactNode }) {
  return (
    <div role="radiogroup" className="flex items-start gap-[8px]">
      {children}
    </div>
  );
}

export function ROITile({ title, caption, width, height, children }: { title: string; caption?: string; width: number; height: number; children: ReactNode }) {
  return (
    <div className="flex flex-col items-start border border-border-on-stage bg-surface-stage-raised" style={{ width, height }}>
      <div className="flex w-full items-center px-[12px] py-[10px]">
        <p className="whitespace-nowrap font-body text-[14px] font-medium leading-[20px] text-text-on-stage">{title}</p>
      </div>
      <div className="relative min-h-px w-full flex-1 overflow-hidden">{children}</div>
      {caption && (
        <div className="flex w-full flex-col items-start px-[12px] py-[10px]">
          <p className="w-full font-body text-[14px] leading-[20px] text-text-on-stage-muted">{caption}</p>
        </div>
      )}
    </div>
  );
}

export function Callout({ kind, title, children }: { kind: 'note' | 'why' | 'caution'; title: string; children: ReactNode }) {
  const word = kind === 'why' ? 'Why?' : kind === 'caution' ? 'Careful' : 'Note';
  return (
    <aside className="flex w-[680px] flex-col items-start gap-[8px] border border-border-strong bg-surface-card px-[24px] py-[16px]">
      <p className="font-heading text-[13px] font-medium uppercase leading-[16px] tracking-[1.5px] text-text-link">{word}</p>
      <p className="w-full font-body text-[14px] font-medium leading-[20px] text-text-primary">{title}</p>
      <div className="w-full font-body text-[14px] leading-[20px] text-text-primary">{children}</div>
    </aside>
  );
}
