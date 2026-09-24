/** P9 Workbench (Figma 126:4081 / 133:4088). */
import { useCallback, useEffect, useRef, useState } from 'react';
import { calSrc, masterHistogram, METHOD_LABEL, ROIS, ROI_KEYS, SENSOR } from './data';
import { LightFramesBlock } from './LightFramesBlock';
import { pngFilename, stackFullPng, useRegionStack, type StackInputs } from './live';
import { Render } from './Render';
import { claimThanks, ThanksModal } from './ThanksModal';
import { matchScenario, SCENARIOS, type Scenario } from './scenarios';
import { LessonPage, PageHead, Reading } from './shell';
import { useAppStore, type AlgorithmName, type FlatLevel } from './store';
import { Btn, Check, Chip, cx, DrawnHistogram, LessonLink, Progress, rovingKeyDown, SectionHeader, T, Tile } from './ui';

const TOPBAR_HEIGHT = 104;
/** Fits the longest scenario text ("Satellite Trail Challenge": label line + description) at 1200 px, 16/24 body: measured 72 px. */
const DESCRIPTION_MIN_HEIGHT = 72;

/** Hover enlargement of a strip tile (owner request): the same live view at 2×, in a floating panel under the tile. */
const HOVER_DELAY_MS = 150;
const HOVER_WELL = { w: 840, h: 560 }; // 2 × the 1440×960 ROI at bin 2 (720×480) ≈ the 282-wide tile at 3×; keeps the 3:2 shape
function StripTile({ region, inputs, job }: { region: (typeof ROI_KEYS)[number]; inputs: StackInputs; job: Job | null }) {
  const { view, pending, empty } = useRegionStack(region, inputs);
  const state = job ? 'processing' : empty ? 'empty' : pending ? 'pending' : 'default';
  const ref = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const [panel, setPanel] = useState<{ left: number; top: number; w: number; h: number } | null>(null);
  const enter = () => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const r = ref.current?.getBoundingClientRect();
      if (!r) return;
      // 2× well, scaled down (3:2 kept) when the space under the strip is shorter; centred under the tile and pulled
      // inside the viewport (8 px margin) when it would overflow sideways
      const top = r.bottom + 8;
      const h = Math.max(240, Math.min(HOVER_WELL.h, window.innerHeight - top - 8 - 42));
      const w = Math.round((h * HOVER_WELL.w) / HOVER_WELL.h);
      const width = w + 2;
      const left = Math.max(8, Math.min(r.left + r.width / 2 - width / 2, window.innerWidth - width - 8));
      setPanel({ left, top, w, h });
    }, HOVER_DELAY_MS);
  };
  const leave = () => { window.clearTimeout(timer.current); setPanel(null); };
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const title = ROIS[region].title;
  return (
    <div ref={ref} className="relative" onMouseEnter={enter} onMouseLeave={leave}>
      <Tile title={title} width={282} height={269} state={state} progress={job ? (100 * job.done) / job.total : undefined}>
        <Render view={view} alt={`${title}, ${METHOD_LABEL[inputs.algorithm]} of ${inputs.frames.length} photographs`} />
      </Tile>
      {panel && view && state === 'default' && (
        <div aria-hidden data-hover-panel={region} className="pointer-events-none fixed z-50 box-border border border-border-on-stage bg-surface-stage-raised shadow-[0_12px_32px_rgba(15,18,32,0.45)]"
          style={{ left: panel.left, top: panel.top, width: panel.w + 2 }}>
          <div className={cx('flex w-full items-center px-3 py-2.5 text-text-on-stage whitespace-nowrap', T.labelMd)}>{title} · enlarged</div>
          <div className="relative overflow-hidden bg-surface-stage" style={{ width: panel.w, height: panel.h }}>
            <Render view={view} />
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Full-width band per section (owner request: the sections should read as separate areas, so the page deviates
 * from the Figma frame here). Type, columns and controls inside are unchanged.
 */
const BAND_BG = {
  page: 'bg-surface-page',
  panel: 'bg-surface-panel',
  card: 'bg-surface-card',
  dark: 'bg-source-dark-soft/25',
  flat: 'bg-source-flat-soft/30',
} as const;
function Band({ tone, children, className }: { tone: keyof typeof BAND_BG; children: React.ReactNode; className?: string }) {
  return (
    <section className={cx('w-full border-t border-border-default py-12', BAND_BG[tone], className)}>
      <div className="mx-auto flex w-[1200px] flex-col gap-6">{children}</div>
    </section>
  );
}

type Job = { done: number; total: number; controller: AbortController };

const METHODS: Array<{ name: AlgorithmName; how: string; count: string }> = [
  { name: 'average', how: 'Adds every value and divides by the count.', count: '2 or more' },
  { name: 'median', how: 'Sorts the values and keeps the middle one.', count: '3 or more' },
  { name: 'kappaSigma', how: 'Drops values far from the average, then averages.', count: '8 to 15' },
  { name: 'winsorized', how: 'Pulls extreme values inward, then averages.', count: '8 or more' },
  { name: 'rcr', how: 'Drops values too unlikely for the count, then averages.', count: '15 or more' },
];

export default function Workbench() {
  const calibration = useAppStore((s) => s.calibration);
  const frames = useAppStore((s) => s.frames);
  const algorithm = useAppStore((s) => s.algorithm);
  const set = useAppStore((s) => s.set);
  const inputs: StackInputs = { frames, calibration, algorithm: algorithm.name };

  const matched = matchScenario(frames, algorithm.name, calibration);
  const [hovered, setHovered] = useState<Scenario | null>(null);
  const shown = hovered ?? matched;
  const applyScenario = (s: Scenario) => set({ frames: [...s.frames], algorithm: { name: s.algorithm, params: {} }, calibration: { ...s.calibration } });

  const setCal = (patch: Partial<typeof calibration>) => set({ calibration: { ...calibration, ...patch } });
  const setFlat = (level: FlatLevel) => setCal({ flat: level });

  const [job, setJob] = useState<Job | null>(null);
  const [output, setOutput] = useState<{ w: number; h: number; cropped: boolean } | null>(null);
  const [thanks, setThanks] = useState(false);
  const closeThanks = useCallback(() => setThanks(false), []);
  const downloadButton = useCallback(() => actionsRef.current?.querySelector<HTMLElement>('button') ?? null, []);
  const jobRef = useRef<Job | null>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  useEffect(() => () => jobRef.current?.controller.abort(), []);
  // Focus follows the job: Cancel while it runs (design-notes §3 "Cancel keeps focus"), the button when it ends.
  const hadJob = useRef(false);
  useEffect(() => {
    const root = actionsRef.current;
    if (!root || (!job && !hadJob.current)) return;
    hadJob.current = job !== null;
    const target = job ? root.querySelector<HTMLElement>('[role="progressbar"] button') : root.querySelector<HTMLElement>('button');
    target?.focus();
  }, [job !== null]);
  const download = async () => {
    const controller = new AbortController();
    const j: Job = { done: 0, total: frames.length, controller };
    jobRef.current = j;
    setJob({ ...j });
    try {
      const out = await stackFullPng(inputs, (done, total) => { j.done = done; j.total = total; setJob({ ...j }); }, controller.signal);
      setOutput({ w: out.w, h: out.h, cropped: out.cropped });
      const url = URL.createObjectURL(out.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = pngFilename(inputs);
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      // The download has started. The first time in this tab session, thank the learner: opened on the next tick so
      // the job-end focus effect below runs before the dialog takes focus (it returns focus to the button on close).
      if (claimThanks()) setTimeout(() => setThanks(true), 0);
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) console.error(e);
    } finally {
      jobRef.current = null;
      setJob(null);
    }
  };

  const calibrationText = [calibration.bias && 'Bias', calibration.dark && 'Dark', calibration.darkFlat && 'Dark flat', calibration.flat && `Flat ${calibration.flat} %`].filter(Boolean).join(' · ') || 'None';
  // stack() reports per-band jobs; the bar shows the equivalent number of frames (SPEC P9: "<percent>% · <n> of <N> frames").
  const percent = job && job.total > 0 ? (100 * job.done) / job.total : 0;
  const framesDone = Math.round((percent / 100) * frames.length);

  return (
    <LessonPage>
      <div className="sticky z-10 flex w-full items-start gap-6 bg-surface-stage px-[120px] py-4" style={{ top: 0, minHeight: 269 + 32 }} data-topbar-height={TOPBAR_HEIGHT}>
        {ROI_KEYS.map((k) => <StripTile key={k} region={k} inputs={inputs} job={job} />)}
      </div>
      <Reading className="pb-12">
        <PageHead eyebrow="Workbench" title="Build your own master"
          lede="Everything the lessons taught is here in one place. Choose the calibration frames, tick the photographs to combine, pick a combination method, and watch the four regions at the top of the page update as you go. Each section links back to the lesson that explains it. When you are happy, stack the full image and download it." />
      </Reading>

        <Band tone="card">
          <SectionHeader title="Preconfigured Scenarios" links={[{ label: 'Lesson: Algorithms →', to: '/algorithms' }]} />
          <div className="flex items-start gap-3">
            {SCENARIOS.map((s) => (
              <Btn key={s.id} variant={s.id === (matched?.id ?? 'default') ? 'primary' : 'secondary'} ariaPressed={matched?.id === s.id}
                onClick={() => applyScenario(s)} onMouseEnter={() => setHovered(s)} onMouseLeave={() => setHovered((h) => (h?.id === s.id ? null : h))}>
                {s.label}
              </Btn>
            ))}
          </div>
          {/* Constant height so hover-swapping the description never moves the sections below (owner request). */}
          <p className={cx('m-0 w-[1200px] text-text-primary', T.bodyMd)} style={{ minHeight: DESCRIPTION_MIN_HEIGHT }}>
            {shown ? shown.label : 'Custom'}<br />
            {shown ? shown.description : 'Your own combination of calibration frames, photographs and method. Press a scenario to return to one of the prepared setups.'}
          </p>
        </Band>

        <Band tone="dark">
          <SectionHeader title="Calibration" />
          <div className="flex w-[1200px] flex-col">
            <div className={cx('flex w-[1200px] gap-4 border-b-2 border-border-strong py-3 text-text-secondary', T.labelMd)}>
              <span className="w-[280px]">Calibration frame</span><span className="w-[152px]">Lesson</span><span className="w-[400px]">Master frame</span><span className="w-[320px]">Histogram</span>
            </div>
            {([
              { key: 'bias', title: 'Bias', link: 'Bias →', to: '/calibration/bias', img: 'bias', checked: calibration.bias, onChange: (v: boolean) => setCal({ bias: v }) },
              { key: 'dark', title: 'Dark', link: 'Darks →', to: '/calibration/darks', img: 'dark', checked: calibration.dark, onChange: (v: boolean) => setCal({ dark: v }) },
              { key: 'darkflat', title: 'Dark flat', link: 'Flats →', to: '/calibration/flats', img: 'darkflat', checked: calibration.darkFlat, onChange: (v: boolean) => setCal({ darkFlat: v }) },
            ] as const).map((r) => (
              <div key={r.key} className="flex w-[1200px] items-start gap-4 border-b border-border-default py-4">
                <div className="flex w-[280px] items-start gap-3">
                  <span className="pt-[5px]"><Check checked={r.checked} onChange={r.onChange} label={r.title} /></span>
                  <div className="flex min-w-px flex-1 flex-col">
                    <span className={cx('w-[250px] text-text-primary', T.h3)}>{r.title}</span>
                  </div>
                </div>
                <LessonLink to={r.to} className="w-[152px] whitespace-normal">{r.link}</LessonLink>
                <img src={calSrc(r.img)} alt={`Master ${r.title.toLowerCase()}`} className="h-[252px] w-[376px] object-cover" draggable={false} />
                <DrawnHistogram bars={masterHistogram(r.img)} width={280} height={100} barWidth={1.6875} />
              </div>
            ))}
          </div>
        </Band>

        <Band tone="flat">
          <SectionHeader title="Flat calibration" links={[{ label: 'Lesson: Flats →', to: '/calibration/flats' }, { label: 'Lesson: Flats, continued →', to: '/calibration/flats-2' }]} />
          <div className="flex w-[1200px] flex-col">
            <div className={cx('flex w-[1200px] gap-4 border-b-2 border-border-strong py-3 text-text-secondary', T.labelMd)}>
              <span className="w-[280px]">Flat</span><span className="w-[400px]">Master flat</span><span className="w-[320px]">Histogram</span>
            </div>
            <div className="flex w-[1200px] items-start gap-4 border-b border-border-default py-4">
              <div className="flex w-[280px] items-start gap-3">
                <span className="pt-[5px]"><Check checked={calibration.flat === null} onChange={(v) => { if (v) setFlat(null); }} label="No flat" /></span>
                <span className={cx('text-text-primary whitespace-nowrap', T.h3)}>No flat</span>
              </div>
              <span className={cx('w-[400px] text-text-secondary', T.bodySm)}>No master flat</span>
              <span className={cx('w-[320px] text-text-secondary', T.bodySm)}>No histogram</span>
            </div>
            {([10, 50, 85] as const).map((level) => (
              <div key={level} className="flex w-[1200px] items-start gap-4 border-b border-border-default py-4">
                <div className="flex w-[280px] items-start gap-3">
                  <span className="pt-[5px]"><Check checked={calibration.flat === level} onChange={(v) => setFlat(v ? level : null)} label={`Flat ${level} %`} /></span>
                  <span className={cx('text-text-primary whitespace-nowrap', T.h3)}>Flat {level} %</span>
                </div>
                <img src={calSrc(`flat_${level}`)} alt={`Master flat, ${level} %`} className="h-[252px] w-[376px] object-cover" draggable={false} />
                <DrawnHistogram bars={masterHistogram(`flat_${level}`)} width={280} height={100} barWidth={1.6875} />
              </div>
            ))}
          </div>
        </Band>

        <Band tone="card">
          <SectionHeader wide title="Light frames" links={[{ label: 'Lesson: Light frames →', to: '/light-frames' }, { label: 'Lesson: Alignment →', to: '/alignment' }]} />
          <p className={cx('m-0 w-[680px] text-text-primary', T.bodyMd)}>
            Tick the photographs to combine. Step through them with Previous frame and Next frame to see the whole frame and the four regions at the same places. Twenty-four entries are listed: the twenty photographs as taken and four altered copies, each marked as a copy of its original.
          </p>
          <LightFramesBlock />
        </Band>

        <Band tone="panel">
          <SectionHeader title="Combination method" links={[{ label: 'Lesson: Algorithms →', to: '/algorithms' }]} />
          <div className="flex w-[1200px] flex-col" role="radiogroup" aria-label="Combination method" onKeyDownCapture={rovingKeyDown}>
            <div className={cx('flex w-[1200px] gap-4 border-b-2 border-border-strong py-3 text-text-secondary', T.labelMd)}>
              <span className="w-[320px]">Method</span><span className="w-[560px]">How it combines the pixel values</span><span className="w-[288px]">Suggested number of photographs</span>
            </div>
            {METHODS.map((m) => (
              <div key={m.name} className="flex w-[1200px] items-center gap-4 border-b border-border-default py-4">
                <div className="flex w-[320px] items-start"><Chip selected={algorithm.name === m.name} onClick={() => set({ algorithm: { name: m.name, params: {} } })}>{METHOD_LABEL[m.name]}</Chip></div>
                <span className={cx('w-[560px] text-text-primary', T.bodyMd)}>{m.how}</span>
                <span className={cx('w-[288px] text-text-primary', T.monoMd)}>{m.count}</span>
              </div>
            ))}
          </div>
        </Band>

        <Band tone="page">
          <SectionHeader title="Your master" />
          <p className={cx('m-0 w-[680px] text-text-primary', T.bodyMd)}>
            This is what the four regions at the top of the page are showing. Stacking the full image takes a while; a progress bar keeps you informed, and the PNG is ready to download when it finishes.
          </p>
          <div className="flex w-[1200px] flex-col gap-3 bg-surface-panel p-6">
            {([
              ['Scenario', matched?.label ?? 'Custom', <LessonLink key="a" to="/algorithms">Lesson: Algorithms →</LessonLink>],
              ['Calibration', calibrationText, <span key="b" className={cx('text-text-link', T.labelMd)}><LessonLink to="/calibration/bias">Lessons: Bias →</LessonLink> <LessonLink to="/calibration/darks">Darks →</LessonLink> <LessonLink to="/calibration/flats">Flats →</LessonLink></span>],
              ['Photographs', `${frames.length} of 24 ticked`, <LessonLink key="c" to="/light-frames">Lesson: Light frames →</LessonLink>],
              ['Method', METHOD_LABEL[algorithm.name], <LessonLink key="d" to="/algorithms">Lesson: Algorithms →</LessonLink>],
              ['Output', output
                ? `PNG, ${output.w} × ${output.h}${output.cropped ? ' after cropping the edges no frame shares' : ', no cropping needed'}`
                : `8-bit PNG, up to ${SENSOR.w} × ${SENSOR.h} pixels, cropped to the area every photograph covers`, null],
            ] as const).map(([label, value, link]) => (
              <div key={label} className="flex w-[1152px] items-start gap-4 text-[14px] leading-5">
                <span className={cx('w-[160px] text-text-secondary', T.labelMd)}>{label}</span>
                <span className={cx('w-[640px] text-text-primary', T.monoMd)}>{value}</span>
                <span className="w-[320px]">{link}</span>
              </div>
            ))}
            <div ref={actionsRef} className="flex items-center gap-4 pt-3">
              <Btn disabled={job !== null || frames.length === 0} onClick={download}>Download PNG</Btn>
              {job && <Progress label="Stacking the full image…" value={`${Math.round(percent)}% · ${framesDone} of ${frames.length} frames`} percent={percent} onCancel={() => job.controller.abort()} />}
            </div>
          </div>
        </Band>
      {thanks && <ThanksModal onClose={closeThanks} returnFocusTo={downloadButton} />}
    </LessonPage>
  );
}
