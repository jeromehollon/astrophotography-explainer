import type { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { sections } from '../../shell/sections';
import { Logo, Icon } from './icons';
import { Button } from './controls';

const cx = (...a: Array<string | false | undefined | null>) => a.filter(Boolean).join(' ');

/* ---------- Layout primitives ---------- */
export function Reading({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('mx-auto flex w-[1200px] flex-col gap-12 py-16', className)}>{children}</div>;
}

export function PageHead({ eyebrow, title, subtitle, lede, className }: { eyebrow: string; title: string; subtitle?: string; lede: ReactNode; className?: string }) {
  return (
    <header className={cx('flex w-[900px] flex-col gap-4', className)}>
      <div className="t-eyebrow text-text-secondary">{eyebrow}</div>
      <h1 className="m-0 t-h1 text-text-primary">{title}</h1>
      {subtitle && <div className="t-subtitle text-text-secondary">{subtitle}</div>}
      <p className="m-0 w-[680px] t-body-lg text-text-primary">{lede}</p>
    </header>
  );
}

export function Prose({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx('prose-astro flex w-[680px] flex-col gap-4 t-body-md text-text-primary', className)}>{children}</div>
  );
}

export function Rule({ className }: { className?: string }) {
  return <hr className={cx('m-0 h-1.5 w-full border-0 bg-border-strong', className)} />;
}

export function Stage({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section className={cx('w-full bg-surface-stage text-text-on-stage', className)}>
      <div className="mx-auto flex w-[1200px] flex-col gap-12 py-16">{children}</div>
    </section>
  );
}

export function StageHead({ eyebrow = 'Try it', title, instructions, className }: { eyebrow?: string; title: string; instructions?: ReactNode; className?: string }) {
  return (
    <header className={cx('flex w-[680px] flex-col gap-3', className)}>
      <div className="t-eyebrow text-text-on-stage-muted">{eyebrow}</div>
      <h2 className="m-0 t-h2 text-text-on-stage">{title}</h2>
      {instructions && <p className="m-0 t-body-md text-text-on-stage-muted">{instructions}</p>}
    </header>
  );
}

export function Experiment({ title, help, controls, children, className }: { title: string; help?: ReactNode; controls: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx('flex w-full flex-col gap-6 border-t border-border-on-stage pt-8', className)}>
      <div className="flex flex-col gap-1">
        <h3 className="m-0 t-h3 text-text-on-stage">{title}</h3>
        {help && <p className="m-0 w-[680px] t-body-sm text-text-on-stage-muted">{help}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-6">{controls}</div>
      <div className="flex flex-wrap items-start gap-6">{children}</div>
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

export function TopBar() {
  const { current, chapters, pages } = useNav();
  const firstOf = (chapter: string) => sections.find((s) => s.chapter === chapter)!;
  return (
    <nav className="w-full border-b border-border-strong bg-surface-page" aria-label="Chapters">
      <div className="mx-auto flex h-16 w-[1200px] items-center">
        <Link to={sections[0]?.path ?? '/welcome'} className="flex w-[304px] items-center gap-3 no-underline focus-cream">
          <Logo size={28} />
          <span className="flex flex-col">
            <span className="t-brand text-text-primary">Calibration &amp; Stacking</span>
            <span className="t-body-sm text-text-secondary" style={{ fontSize: 12, lineHeight: '14px' }}>Astrophotography explained</span>
          </span>
        </Link>
        <ul className="m-0 flex list-none items-center gap-8 p-0">
          {chapters.map((c) => {
            const active = current?.chapter === c;
            return (
              <li key={c}>
                <Link to={firstOf(c).path} aria-current={active ? 'page' : undefined}
                  className={cx('inline-flex h-16 items-center border-b-[3px] t-label-md no-underline focus-cream', active ? 'border-border-strong text-text-primary' : 'border-transparent text-text-secondary hover:text-text-primary')}>
                  {c}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="border-t border-border-default">
        <div className="mx-auto flex h-10 w-[1200px] items-center gap-6 pl-[304px]">
          {pages.filter((p) => p.page).map((p) => {
            const active = p.path === current?.path;
            return (
              <Link key={p.path} to={p.path} aria-current={active ? 'page' : undefined}
                className={cx('t-label-sm no-underline focus-cream', active ? 'text-text-primary underline underline-offset-4' : 'text-text-secondary hover:text-text-primary')}>
                {p.page}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

export function BottomNav() {
  const { index, prev, next } = useNav();
  const navigate = useNavigate();
  const isWelcome = index === 0;
  return (
    <nav className="w-full border-t border-border-strong bg-surface-page" aria-label="Pages">
      <div className="mx-auto flex h-24 w-[1200px] items-center justify-between">
        <div>
          {prev && !isWelcome && (
            <Button variant="ghost" onClick={() => navigate(prev.path)}><Icon name="chevron-left" />Previous: {prev.title}</Button>
          )}
        </div>
        <div>
          {next && (
            <Button variant={isWelcome ? 'primary' : 'secondary'} onClick={() => navigate(next.path)}>
              {isWelcome ? `Start: ${next.title}` : `Next: ${next.title}`}<Icon name="chevron-right" />
            </Button>
          )}
        </div>
      </div>
    </nav>
  );
}

export function LessonPage({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx('flex min-h-screen flex-col bg-surface-page', className)}>
      <TopBar />
      <main className="flex flex-1 flex-col">{children}</main>
      <BottomNav />
    </div>
  );
}
