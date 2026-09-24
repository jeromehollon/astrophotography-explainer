/** P9 Workbench (Figma 126:4081 / 133:4088). */
import { useEffect, useRef, useState } from 'react';
import { calSrc, masterHistogram, METHOD_LABEL, ROIS, ROI_KEYS, SENSOR } from './data';
import { LightFramesBlock } from './LightFramesBlock';
import { pngFilename, stackFullPng, useRegionStack, type StackInputs } from './live';
import { Render } from './Render';
import { matchScenario, SCENARIOS, type Scenario } from './scenarios';
import { LessonPage, PageHead, Reading } from './shell';
import { useAppStore, type AlgorithmName, type FlatLevel } from './store';
import { Btn, Check, Chip, cx, DrawnHistogram, LessonLink, Progress, SectionHeader, T, Tile } from './ui';

const TOPBAR_HEIGHT = 104;

function StripTile({ region, inputs, job }: { region: (typeof ROI_KEYS)[number]; inputs: StackInputs; job: Job | null }) {
  const { view, pending, empty } = useRegionStack(region, inputs);
  const state = job ? 'processing' : empty ? 'empty' : pending ? 'pending' : 'default';
  return (
    <Tile title={ROIS[region].title} width={282} height={269} state={state} progress={job ? (100 * job.done) / job.total : undefined}>
      <Render view={view} alt={`${ROIS[region].title}, ${METHOD_LABEL[inputs.algorithm]} of ${inputs.frames.length} photographs`} />
    </Tile>
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
  const jobRef = useRef<Job | null>(null);
  useEffect(() => () => jobRef.current?.controller.abort(), []);
  const download = async () => {
    const controller = new AbortController();
    const j: Job = { done: 0, total: frames.length, controller };
    jobRef.current = j;
    setJob({ ...j });
    try {
      const blob = await stackFullPng(inputs, (done, total) => { j.done = done; j.total = total; setJob({ ...j }); }, controller.signal);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = pngFilename(inputs);
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) console.error(e);
    } finally {
      jobRef.current = null;
      setJob(null);
    }
  };

  const calibrationText = [calibration.bias && 'Bias', calibration.dark && 'Dark', calibration.darkFlat && 'Dark flat', calibration.flat && `Flat ${calibration.flat} %`].filter(Boolean).join(' · ') || 'None';
  const percent = job ? (100 * job.done) / job.total : 0;

  return (
    <LessonPage>
      <div className="sticky z-10 flex w-full items-start gap-6 bg-surface-stage px-[120px] py-4" style={{ top: 0, minHeight: 269 + 32 }} data-topbar-height={TOPBAR_HEIGHT}>
        {ROI_KEYS.map((k) => <StripTile key={k} region={k} inputs={inputs} job={job} />)}
      </div>
      <Reading>
        <PageHead eyebrow="Workbench" title="Build your own master"
          lede="Everything the lessons taught is here in one place. Choose the calibration frames, tick the photographs to combine, pick a combination method, and watch the four regions at the top of the page update as you go. Each section links back to the lesson that explains it. When you are happy, stack the full image and download it." />

        <section className="flex flex-col gap-6">
          <SectionHeader title="Preconfigured Scenarios" links={[{ label: 'Lesson: Algorithms →', to: '/algorithms' }]} />
          <div className="flex items-start gap-3">
            {SCENARIOS.map((s) => (
              <Btn key={s.id} variant={s.id === (matched?.id ?? 'default') ? 'primary' : 'secondary'} ariaPressed={matched?.id === s.id}
                onClick={() => applyScenario(s)} onMouseEnter={() => setHovered(s)} onMouseLeave={() => setHovered((h) => (h?.id === s.id ? null : h))}>
                {s.label}
              </Btn>
            ))}
          </div>
          <p className={cx('m-0 w-[1200px] text-text-primary', T.bodyMd)}>
            {shown ? shown.label : 'Custom'}<br />
            {shown ? shown.description : 'Your own combination of calibration frames, photographs and method. Press a scenario to return to one of the prepared setups.'}
          </p>
        </section>

        <section className="flex flex-col gap-6">
          <SectionHeader title="Calibration" />
          <div className="flex w-[1200px] flex-col">
            <div className={cx('flex w-[1200px] gap-4 border-b-2 border-border-strong py-3 text-text-secondary', T.labelMd)}>
              <span className="w-[280px]">Calibration frame</span><span className="w-[152px]">Lesson</span><span className="w-[400px]">Master frame</span><span className="w-[320px]">Histogram</span>
            </div>
            {([
              { key: 'bias', title: 'Bias', link: 'Bias →', to: '/calibration/bias', img: 'bias', checked: calibration.bias, onChange: (v: boolean) => setCal({ bias: v }),
                note: calibration.dark ? (calibration.darkFlat ? 'Already inside the dark; not applied on its own.' : 'Already inside the dark; used for the flats only.') : '' },
              { key: 'dark', title: 'Dark', link: 'Darks →', to: '/calibration/darks', img: 'dark', checked: calibration.dark, onChange: (v: boolean) => setCal({ dark: v }), note: '' },
              { key: 'darkflat', title: 'Dark flat', link: 'Flats →', to: '/calibration/flats', img: 'darkflat', checked: calibration.darkFlat, onChange: (v: boolean) => setCal({ darkFlat: v }), note: '' },
            ] as const).map((r) => (
              <div key={r.key} className="flex w-[1200px] items-start gap-4 border-b border-border-default py-4">
                <div className="flex w-[280px] items-start gap-3">
                  <span className="pt-[5px]"><Check checked={r.checked} onChange={r.onChange} label={r.title} /></span>
                  <div className="flex min-w-px flex-1 flex-col">
                    <span className={cx('w-[250px] text-text-primary', T.h3)}>{r.title}</span>
                    {r.note && <span className={cx('w-[250px] text-text-secondary', T.bodySm)}>{r.note}</span>}
                  </div>
                </div>
                <LessonLink to={r.to} className="w-[152px] whitespace-normal">{r.link}</LessonLink>
                <img src={calSrc(r.img)} alt={`Master ${r.title.toLowerCase()}`} className="h-[252px] w-[376px] object-cover" draggable={false} />
                <DrawnHistogram bars={masterHistogram(r.img)} width={280} height={100} barWidth={1.6875} />
              </div>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-6">
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
        </section>

        <section className="flex flex-col gap-6">
          <SectionHeader wide title="Light frames" links={[{ label: 'Lesson: Light frames →', to: '/light-frames' }, { label: 'Lesson: Alignment →', to: '/alignment' }]} />
          <p className={cx('m-0 w-[680px] text-text-primary', T.bodyMd)}>
            Tick the photographs to combine. Step through them with Previous frame and Next frame to see the whole frame and the four regions at the same places. Twenty-four entries are listed: the twenty photographs as taken and four altered copies, each marked as a copy of its original.
          </p>
          <LightFramesBlock />
        </section>

        <section className="flex flex-col gap-6">
          <SectionHeader title="Combination method" links={[{ label: 'Lesson: Algorithms →', to: '/algorithms' }]} />
          <div className="flex w-[1200px] flex-col" role="radiogroup" aria-label="Combination method">
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
        </section>

        <section className="flex flex-col gap-6">
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
              ['Output', `${SENSOR.w} × ${SENSOR.h} pixels, 8-bit PNG with the stretch shown on screen`, null],
            ] as const).map(([label, value, link]) => (
              <div key={label} className="flex w-[1152px] items-start gap-4 text-[14px] leading-5">
                <span className={cx('w-[160px] text-text-secondary', T.labelMd)}>{label}</span>
                <span className={cx('w-[640px] text-text-primary', T.monoMd)}>{value}</span>
                <span className="w-[320px]">{link}</span>
              </div>
            ))}
            <div className="flex items-center gap-4 pt-3">
              <Btn disabled={job !== null || frames.length === 0} onClick={download}>Download PNG</Btn>
              {job && <Progress label="Stacking the full image…" value={`${Math.round(percent)}% · ${job.done} of ${job.total} frames`} percent={percent} onCancel={() => job.controller.abort()} />}
            </div>
          </div>
        </section>
      </Reading>
    </LessonPage>
  );
}
