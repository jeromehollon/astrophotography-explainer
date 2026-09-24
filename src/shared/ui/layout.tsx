import { useRef, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { sections } from '../../shell/sections';
import { Logo } from './icons';
import { Button } from './controls';
import { Lightbox } from './lightbox';

const cx = (...a: Array<string | false | undefined | null>) => a.filter(Boolean).join(' ');

/* ---------- Reading column (Template/Lesson page 11:29): 1200 wide at x 120, 64 px top/bottom, 32 px between blocks ---------- */
export function Reading({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('mx-auto flex w-[1200px] flex-col items-start gap-8 py-16', className)}>{children}</div>;
}

/* page-head (17:1128): eyebrow (text/link) · h1 at 900 · optional subtitle (Jost Medium 24/32, design-notes §7) · lede body/lg secondary at 680; 12 px stack */
export function PageHead({ eyebrow, title, subtitle, lede, className }: { eyebrow: string; title: string; subtitle?: string; lede: ReactNode; className?: string }) {
  return (
    <header className={cx('flex w-[900px] flex-col items-start gap-3', className)}>
      <div className="t-eyebrow text-text-link">{eyebrow}</div>
      <h1 className="m-0 w-[900px] t-h1 text-text-primary">{title}</h1>
      {subtitle && <div className="w-[900px] t-subtitle text-text-secondary">{subtitle}</div>}
      <p className="m-0 w-[680px] t-body-lg text-text-secondary">{lede}</p>
    </header>
  );
}

/* prose (45:836): 680 column, 24 px stack, body/md; h2/h3 styled by .prose-astro in tokens.css */
export function Prose({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('prose-astro flex w-[680px] flex-col items-start gap-6 t-body-md text-text-primary', className)}>{children}</div>;
}

/* rule (19:82): 6 px ink, full width */
export function Rule({ className }: { className?: string }) {
  return <hr className={cx('m-0 h-1.5 w-full border-0 bg-border-strong', className)} />;
}

/* try-it stage (19:83): surface/stage, 48 px top/bottom, content at the 1200 column, 40 px between blocks */
export function Stage({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section className={cx('w-full bg-surface-stage text-text-on-stage', className)}>
      <div className="mx-auto flex w-[1200px] flex-col items-start gap-10 py-12">{children}</div>
    </section>
  );
}

/* stage-head (19:84): eyebrow "Try it" · h2 at 900 · instructions body/md muted at 680; 12 px stack */
export function StageHead({ eyebrow = 'Try it', title, instructions, className }: { eyebrow?: string; title: string; instructions?: ReactNode; className?: string }) {
  return (
    <header className={cx('flex w-[900px] flex-col items-start gap-3', className)}>
      <div className="t-eyebrow text-text-on-stage-muted">{eyebrow}</div>
      <h2 className="m-0 w-[900px] t-h2 text-text-on-stage">{title}</h2>
      {instructions && <p className="m-0 w-[680px] t-body-md text-text-on-stage-muted">{instructions}</p>}
    </header>
  );
}

/* experiment (19:88): header row (h3 · controls · help at 360, 24 px gaps) then tiles row 16 px below with 24 px gaps */
export function Experiment({ title, help, controls, children, className }: { title: string; help?: ReactNode; controls: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx('flex w-full flex-col items-start gap-4', className)}>
      <div className="flex items-center gap-6">
        <h3 className="m-0 t-h3 text-text-on-stage whitespace-nowrap">{title}</h3>
        <div className="flex items-center gap-6">{controls}</div>
        {help && <p className="m-0 w-[360px] t-body-sm text-text-on-stage-muted">{help}</p>}
      </div>
      <div className="flex items-start gap-6">{children}</div>
    </section>
  );
}

/* ---------- Navigation derived from the registry + current route ---------- */
function useNav() {
  const { pathname } = useLocation();
  const index = sections.findIndex((s) => s.path === pathname);
  const current = index >= 0 ? sections[index] : undefined;
  const chapters = [...new Set(sections.map((s) => s.chapter))];
  const pages = current ? sections.filter((s) => s.chapter === current.chapter) : [];
  return { index, current, chapters, pages, prev: index > 0 ? sections[index - 1] : undefined, next: index >= 0 ? sections[index + 1] : undefined };
}

/* TopBar (17:1087): row 1 = brand + chapter tabs (64 px, 2 px ink rule); row 2 = pages of the current chapter (40 px, surface/panel).
   Current tab: ink text + 3 px cobalt indicator; other tabs are cobalt links. */
export function TopBar() {
  const { current, chapters, pages } = useNav();
  const firstOf = (chapter: string) => sections.find((s) => s.chapter === chapter)!;
  const tab = (active: boolean) => cx('t-label-md whitespace-nowrap no-underline focus-cream', active ? 'text-text-primary' : 'text-text-link hover:underline');
  return (
    <nav className="flex w-full flex-col bg-surface-page" aria-label="Chapters">
      <div className="box-border flex h-16 w-full items-center gap-16 border-b-2 border-solid border-border-strong px-[120px]">
        <Link to={sections[0]?.path ?? '/welcome'} className="flex items-center gap-2.5 no-underline focus-cream" aria-label="Calibration & Stacking: Astrophotography explained">
          <Logo size={28} />
          <span className="flex flex-col items-start whitespace-nowrap">
            <span className="t-brand text-text-primary">Calibration &amp; Stacking</span>
            <span className="t-brand-sub text-text-secondary">Astrophotography explained</span>
          </span>
        </Link>
        <ul className="m-0 flex h-full list-none items-start gap-7 p-0">
          {chapters.map((c) => {
            const active = current?.chapter === c;
            return (
              <li key={c} className="flex h-16 flex-col items-start justify-between pb-0.5 pt-[22px]">
                <Link to={firstOf(c).path} aria-current={active ? 'page' : undefined} className={tab(active)}>{c}</Link>
                <span className={cx('h-[3px] w-full', active && 'bg-accent-primary')} aria-hidden="true" />
              </li>
            );
          })}
        </ul>
      </div>
      <div className="box-border flex h-10 w-full items-start gap-7 border-b border-solid border-border-default bg-surface-panel px-[120px]">
        <span className="h-px w-[276px] shrink-0" aria-hidden="true" />
        {pages.map((p) => {
          const active = p.path === current?.path;
          return (
            <div key={p.path} className="flex h-10 flex-col items-start justify-between pt-[11px]">
              <Link to={p.path} aria-current={active ? 'page' : undefined} className={tab(active)}>{p.page || p.chapter}</Link>
              <span className={cx('h-[3px] w-full', active && 'bg-accent-primary')} aria-hidden="true" />
            </div>
          );
        })}
      </div>
    </nav>
  );
}

/* BottomNav (11:28): 88 px, 1 px border/default on top; previous (Secondary) far left, next (Primary) far right.
   Welcome (57:684) shows only "Start: Noise & Defects →"; Workbench (126:4146) shows only "← Light frames". */
export function BottomNav() {
  const { index, prev, next } = useNav();
  const navigate = useNavigate();
  const isWelcome = index === 0;
  return (
    <nav className="box-border flex h-[88px] w-full items-center justify-between border-t border-solid border-border-default bg-surface-page px-[120px]" aria-label="Pages">
      <div>{prev && !isWelcome && <Button variant="secondary" onClick={() => navigate(prev.path)}>← {prev.asPrev ?? prev.title}</Button>}</div>
      <div>{next && <Button variant="primary" onClick={() => navigate(next.path)}>{isWelcome ? `Start: ${next.asNext ?? next.title} →` : `${next.asNext ?? next.title} →`}</Button>}</div>
    </nav>
  );
}

/* Page card: the 1440 px Figma page sits centred on a darker cream viewport (surface/viewport) with a soft shadow.
   No transform or overflow here, so position: sticky inside <main> (the Workbench ROI strip) still sticks to the viewport.
   Every <img>/<canvas> inside <main> opens the global Lightbox (see lightbox.tsx). */
export function LessonPage({ children, className }: { children: ReactNode; className?: string }) {
  const mainRef = useRef<HTMLElement>(null);
  return (
    <div className={cx('mx-auto flex min-h-screen w-[1440px] flex-col bg-surface-page shadow-[0_2px_24px_rgba(28,26,23,0.10)]', className)}>
      <TopBar />
      <main ref={mainRef} className="flex flex-1 flex-col">{children}</main>
      <BottomNav />
      <Lightbox root={mainRef} />
    </div>
  );
}
