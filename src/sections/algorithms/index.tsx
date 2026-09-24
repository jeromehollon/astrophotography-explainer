// Algorithms lesson (SPEC P7). Layout, sizes and prose follow the Figma frames
// "P7 · Algorithms — A · average" (84:2) and "B · median" (114:242) on page 8:10.
// The only interaction is the Average / Median chip group, which swaps the
// Computed image and its caption and records the choice in the shared store.
import { LessonPage, Chip, ChipGroup, ROITile, Callout } from './shim/ui';
import { useAppStore } from './shim/store';
import roiF02 from './assets/roi_f02.png';
import roiF03 from './assets/roi_f03.png';
import roiF04 from './assets/roi_f04.png';
import roiF05 from './assets/roi_f05.png';
import stack4Average from './assets/stack4_average.png';
import stack4Median from './assets/stack4_median.png';
import stack15Average from './assets/stack15_average.png';
import stack15Median from './assets/stack15_median.png';
import stack15Kappa from './assets/stack15_kappa_sigma.png';
import stack15Winsorized from './assets/stack15_winsorized.png';
import stack15Rcr from './assets/stack15_rcr.png';

type Method = 'average' | 'median';

const computed: Record<Method, { src: string; caption: string }> = {
  average: {
    src: stack4Average,
    caption:
      'Average of the four frames. The trail is still there at a quarter of its brightness, because the average counts every value.',
  },
  median: {
    src: stack4Median,
    caption:
      'Median of the four frames. At most pixels the trail value is the largest of the four, so the median leaves it out and the trail almost disappears.',
  },
};

const inputs = [
  { label: 'Frame 3', src: roiF03 },
  { label: 'Frame 2', src: roiF02 },
  { label: 'Frame 4', src: roiF04 },
  { label: 'Frame 5', src: roiF05 },
];

// One trail pixel across the four frames (assets/algorithms/stats.json one_pixel).
const onePixel = [
  { label: 'Frame 3', value: '985', note: 'satellite trail', trail: true },
  { label: 'Frame 2', value: '908', note: 'plain sky' },
  { label: 'Frame 4', value: '903', note: 'plain sky' },
  { label: 'Frame 5', value: '909', note: 'plain sky' },
];

const methodRows = [
  {
    method: 'Average',
    frames: '2 or more',
    unusual: 'Every valid contribution shares in the result. An unusually bright value pulls the average upward.',
    useful: 'Frames with no defects. It gives the lowest noise for a given number of frames.',
  },
  {
    method: 'Median',
    frames: '3 or more',
    unusual:
      'Values are sorted. An odd count uses the middle value; an even count averages the middle two. A single extreme measurement cannot dominate when most contributions are unaffected.',
    useful:
      'Try it with three or more independent photographs when isolated defects are a concern. With two values it equals the average; for clean data it usually leaves more random noise than averaging.',
  },
  {
    method: 'Kappa-sigma clipping',
    frames: '8 to 15 frames',
    unusual:
      '“Sigma” describes the usual spread in brightness. Values farther from the center than a chosen multiple of that spread are rejected; the remaining values are averaged.',
    useful:
      'Useful when you have enough good exposures to estimate the usual spread reliably. A small stack or repeated defects can make that estimate misleading.',
  },
  {
    method: 'Winsorized sigma clipping',
    frames: '8 or more frames',
    unusual:
      'Extreme values are limited while estimating the center and spread, so they have less influence on the rejection threshold. Rejected original samples are left out of the final average.',
    useful:
      'A useful option for a larger set with occasional strong outliers. It still needs a well-aligned majority of good measurements and a check for unwanted rejection.',
  },
  {
    method: 'Robust Chauvenet rejection',
    frames: '15 or more frames',
    unusual:
      'The best method for rejected outliers if you have enough frames. It can identify outliers without letting outliers determine where the outliers are. Remaining values are averaged.',
    useful:
      'An option for larger stacks with isolated outliers when the behavior of the selected implementation is understood. More photographs help; they do not make blurred or cloudy exposures good.',
  },
];

// The same trail pixel across the first fifteen frames (stats.json fifteen_frames.one_pixel_traces).
const fifteenValues = [903, 913, 908, 985, 903, 909, 901, 918, 904, 916, 905, 905, 915, 920, 907];
const medianIndex = 2; // Frame 2 = 908, the median of the fifteen
const rejectedIndex = 3; // Frame 3 = 985, rejected in the first pass by every method
const survivorsEquation = '(903 + 913 + 908 + 903 + 909 + 901 + 918 + 904 + 916 + 905 + 905 + 915 + 920 + 907) ÷ 14 = 909.1';

const fifteenTiles = [
  { src: roiF03, caption: 'Frame 0003 on its own' },
  { src: stack15Average, caption: 'Average' },
  { src: stack15Median, caption: 'Median' },
  { src: stack15Kappa, caption: 'Kappa-sigma clipping' },
  { src: stack15Winsorized, caption: 'Winsorized sigma clipping' },
  { src: stack15Rcr, caption: 'Robust Chauvenet rejection' },
];

const eyebrow = 'font-heading text-[13px] font-medium uppercase leading-[16px] tracking-[1.5px]';
const h2 = 'w-[680px] font-heading text-[28px] font-semibold leading-[34px] text-text-primary';
const bodyMd = 'w-[680px] font-body text-[16px] leading-[24px] text-text-primary';
const labelMd = 'font-body text-[14px] font-medium leading-[20px]';
const bodySm = 'font-body text-[14px] leading-[20px]';
const monoMd = 'font-mono text-[14px] leading-[20px] text-text-primary';

function WorkedExample({ steps, explanation }: { steps: string[]; explanation: string }) {
  return (
    <div className="flex w-[1200px] flex-col items-start gap-[20px] border border-border-default bg-surface-card p-[24px]">
      <p className={`${eyebrow} whitespace-nowrap text-text-secondary`}>The same trail pixel across fifteen frames</p>
      <div className="flex items-start gap-[8px] whitespace-nowrap">
        {fifteenValues.map((v, i) => {
          const tone =
            i === medianIndex
              ? 'bg-cream-300 border-2 border-border-strong'
              : i === rejectedIndex
                ? 'bg-source-dark-soft'
                : 'bg-surface-panel';
          return (
            <div key={i} className={`flex w-[69.3px] flex-col items-start gap-[4px] px-[8px] py-[10px] ${tone}`}>
              <p className="font-body text-[12px] font-medium leading-[16px] tracking-[0.2px] text-text-secondary">Frame {i}</p>
              <p className={monoMd}>{v}</p>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-[24px]">
        <div className="flex items-center gap-[8px]">
          <span className="size-[16px] border-2 border-border-strong bg-cream-300" />
          <p className={`${labelMd} whitespace-nowrap text-text-secondary`}>Median</p>
        </div>
        <div className="flex items-center gap-[8px]">
          <span className="size-[16px] border border-border-default bg-source-dark-soft" />
          <p className={`${labelMd} whitespace-nowrap text-text-secondary`}>Rejected</p>
        </div>
      </div>
      <ol className="flex flex-col items-start gap-[8px]">
        {steps.map((text, i) => (
          <li key={i} className="flex items-start gap-[16px]">
            <p className={`${labelMd} w-[24px] text-text-secondary`}>{i + 1}.</p>
            <p className={`${monoMd} w-[1112px] whitespace-pre-wrap`}>{text}</p>
          </li>
        ))}
      </ol>
      <div className="flex w-[1152px] flex-col items-start gap-[8px] border border-border-default px-[20px] py-[16px]">
        <p className={`${labelMd} whitespace-nowrap text-text-primary`}>Result: 909.1</p>
        <p className={`${monoMd} w-[1112px]`}>{survivorsEquation}</p>
        <p className={`${bodySm} w-[1112px] text-text-secondary`}>{explanation}</p>
      </div>
    </div>
  );
}

export default function AlgorithmsPage() {
  const name = useAppStore((s) => s.algorithm.name);
  const params = useAppStore((s) => s.algorithm.params);
  const set = useAppStore((s) => s.set);
  const method: Method = name === 'median' ? 'median' : 'average';
  const choose = (m: Method) => set({ algorithm: { name: m, params } });

  return (
    <LessonPage>
      {/* page head */}
      <section className="flex flex-col items-start gap-[32px] px-[120px] py-[64px]">
        <div className="flex flex-col items-start gap-[12px]">
          <p className={`${eyebrow} whitespace-nowrap text-text-link`}>Chapter 6 · Algorithms</p>
          <h1 className="w-[900px] font-heading text-[40px] font-semibold leading-[46px] tracking-[-0.5px] text-text-primary">
            Keeping a useful exposure when a satellite passes
          </h1>
          <p className="w-[680px] font-body text-[18px] leading-[28px] text-text-secondary">
            A satellite crossed the telescope’s view while Frame 0003 was being exposed. Its trail is bright enough to survive an
            average, even though most of the photograph still contains useful light from the sky. Before we discard that exposure,
            we can ask the other photographs what belongs at each position.
          </p>
        </div>
      </section>

      <div className="h-[6px] w-full bg-border-strong" />

      {/* Try-it stage */}
      <section className="flex flex-col items-start gap-[40px] bg-surface-stage px-[120px] py-[48px]">
        <div className="flex flex-col items-start gap-[12px]">
          <p className={`${eyebrow} whitespace-nowrap text-text-on-stage-muted`}>Try it</p>
          <h2 className="w-[900px] font-heading text-[28px] font-semibold leading-[34px] text-text-on-stage">Stack four frames two ways</h2>
          <p className="w-[680px] font-body text-[16px] leading-[24px] text-text-on-stage-muted">
            We are using Frame 0003 together with three other photographs, Frames 0002, 0004 and 0005. They have already been
            calibrated and aligned. Examine how the satellite trail changes when we select different algorithms.
          </p>
        </div>

        <div className="flex flex-col items-start gap-[16px]">
          <div className="flex items-center gap-[24px]">
            <h3 className="whitespace-nowrap font-heading text-[22px] font-medium leading-[28px] text-text-on-stage">Combining the frames</h3>
            <ChipGroup>
              <Chip selected={method === 'average'} onClick={() => choose('average')}>
                Average
              </Chip>
              <Chip selected={method === 'median'} onClick={() => choose('median')}>
                Median
              </Chip>
            </ChipGroup>
          </div>

          <div className="flex items-start gap-[48px]">
            <ROITile
              title="Raw"
              width={576}
              height={676}
              caption="Frame 3 on its own, calibrated and aligned. The satellite trail runs from the upper right to the lower left."
            >
              <img src={roiF03} alt="" className="absolute inset-0 size-full max-w-none object-cover" />
            </ROITile>
            <ROITile title="Computed" width={576} height={676} caption={computed[method].caption}>
              <img src={computed[method].src} alt="" className="absolute inset-0 size-full max-w-none object-cover" />
            </ROITile>
          </div>

          <div className="flex flex-col items-start gap-[12px]">
            <p className={`${labelMd} whitespace-nowrap text-text-on-stage-muted`}>The four frames in the stack</p>
            <div className="flex items-start gap-[16px]">
              {inputs.map((f) => (
                <div key={f.label} className="flex flex-col items-start gap-[8px]">
                  <img src={f.src} alt="" width={132} height={132} className="block size-[132px] object-cover" />
                  <p className={`${labelMd} whitespace-nowrap text-text-on-stage`}>{f.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <Callout kind="why" title="Why does a faint trace of the trail survive the median?">
          The median only leaves the trail value out when it is the largest of the four. The trail is faint: it raises the pixel
          brightness by about 28, while ordinary noise moves the same pixel by about 12 from one frame to the next. At most trail
          pixels in the region above (about 86 %) Frame 0003 is indeed the brightest and drops out. At the rest, a noisy sky value in
          another frame happens to be higher, the trail value becomes one of the middle two, and a little of it leaks through. That
          leak is the faint remnant you can still see with Median. More frames make it rarer, because the trail value then only has
          to land somewhere in the upper half of the sorted values to be left out.
        </Callout>
      </section>

      {/* reading-2 */}
      <div className="flex flex-col items-start gap-[48px] px-[120px] py-[64px]">
        <section className="flex flex-col items-start gap-[24px]">
          <h2 className={h2}>What happens at one pixel</h2>
          <p className={bodyMd}>
            The below example takes one pixel from the satellite trail in frame 3 and compares it to the other 3 frames. See how the
            two algorithms treat it differently.
          </p>
          <div className="flex w-[1200px] flex-col items-start gap-[24px] border border-border-default bg-surface-card p-[24px]">
            <p className={`${eyebrow} whitespace-nowrap text-text-secondary`}>Brightness of one pixel in each frame</p>
            <div className="flex items-start gap-[24px] whitespace-nowrap">
              {onePixel.map((v) => (
                <div
                  key={v.label}
                  className={`flex w-[264px] flex-col items-start gap-[8px] px-[20px] py-[16px] ${v.trail ? 'bg-source-external-soft' : 'bg-surface-panel'}`}
                >
                  <p className={`${labelMd} text-text-primary`}>{v.label}</p>
                  <p className="font-mono text-[22px] font-medium leading-[28px] text-text-primary">{v.value}</p>
                  <p className={`${bodySm} text-text-secondary`}>{v.note}</p>
                </div>
              ))}
            </div>
            <div className="flex items-start gap-[24px]">
              <div className="flex w-[564px] flex-col items-start gap-[8px] border border-border-default px-[20px] py-[16px]">
                <p className={`${labelMd} whitespace-nowrap text-text-primary`}>Average</p>
                <p className={`${monoMd} w-[524px]`}>(985 + 908 + 903 + 909) ÷ 4 = 926.25</p>
                <p className={`${bodySm} w-[524px] text-text-secondary`}>
                  Every value counts. The satellite lifts the result well above the sky, so the trail stays in the picture.
                </p>
              </div>
              <div className="flex w-[564px] flex-col items-start gap-[8px] border border-border-default px-[20px] py-[16px]">
                <p className={`${labelMd} whitespace-nowrap text-text-primary`}>Median</p>
                <p className={`${monoMd} w-[524px]`}>sorted: 903, 908, 909, 985. Median: 908.5</p>
                <p className={`${bodySm} w-[524px] text-text-secondary`}>
                  The satellite value is the largest, so it is left out. The result is plain sky.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="flex flex-col items-start gap-[24px]">
          <h2 className={h2}>Five ways to combine a stack</h2>
          <p className={bodyMd}>
            Average and median are the two simplest rules. There are three other more advanced algorithms that can be utilized
            depending on your stack of images.
          </p>
          <table className="w-[1200px] border-collapse text-[14px] leading-[20px]">
            <thead>
              <tr className="border-b-2 border-border-strong text-left align-top text-text-secondary">
                <th className={`${labelMd} w-[200px] py-[12px] pr-[24px]`}>Method</th>
                <th className={`${labelMd} w-[180px] py-[12px] pr-[24px]`}>Recommended for</th>
                <th className={`${labelMd} w-[372px] py-[12px] pr-[24px]`}>What happens to an unusual value</th>
                <th className={`${labelMd} w-[376px] py-[12px]`}>When it is useful</th>
              </tr>
            </thead>
            <tbody>
              {methodRows.map((r) => (
                <tr key={r.method} className="border-b border-border-default align-top text-text-primary">
                  <td className={`${labelMd} py-[12px] pr-[24px]`}>{r.method}</td>
                  <td className={`${bodySm} py-[12px] pr-[24px]`}>{r.frames}</td>
                  <td className={`${bodySm} py-[12px] pr-[24px]`}>{r.unusual}</td>
                  <td className={`${bodySm} py-[12px]`}>{r.useful}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="flex flex-col items-start gap-[24px]">
          <h2 className={h2}>Kappa-sigma clipping</h2>
          <p className={bodyMd}>
            At each pixel the method finds the median value and the standard deviation of the values around it. Any value more than a
            set number of standard deviations from the middle is thrown out. The usual limits are 3 standard deviations above and 4
            below, because bright surprises such as trails and hot pixels are far more common than dark ones. After a rejection the
            middle and the spread are measured again on the survivors, and the test repeats until nothing more is rejected. The
            survivors are then averaged.
          </p>
          <WorkedExample
            steps={[
              'Middle value (median of the fifteen) = 908',
              'Standard deviation of the fifteen = 19.8  (the 985 is inside this measurement and inflates it)',
              'Limits: below 908 − 4 × 19.8 = 828.8, above 908 + 3 × 19.8 = 967.4',
              '985 is above the limit and is rejected. Second pass on the fourteen survivors: middle 907.5, standard deviation 6.0, limits 883.6 to 925.4, nothing more rejected.',
            ]}
            explanation="Plain sky. With fifteen values one outlier no longer swamps the spread: 985 sits 3.9 standard deviations above the middle, past the limit of 3. With four or eight values it could not get past 3, which is why this method is recommended for 8 to 15 frames and works better toward the upper end."
          />
        </section>

        <section className="flex flex-col items-start gap-[24px]">
          <h2 className={h2}>Winsorized sigma clipping</h2>
          <p className={bodyMd}>
            Winsorizing repairs that weakness by measuring the spread more carefully. Before the standard deviation is calculated,
            every value far from the middle is pulled in to the edge of the normal range, about one and a half spreads out, and a
            value very far out, beyond five spreads, is replaced by the middle value itself. A spread measured on these tamed values
            is no longer inflated by the outlier. The rejection then runs exactly as in kappa-sigma clipping, with the same limits of
            3 above and 4 below, and the survivors are averaged.
          </p>
          <p className={bodyMd}>
            A lone bright value can be rejected even in a small stack, though the estimate of the spread itself needs 8 or more frames
            to be trustworthy. On our four frames it rejected Frame 0003 at about 8 % of the trail pixels; with the fifteen frames
            below, at about 33 %. The rest of the trail sits within 3 standard deviations of the sky noise at each pixel and is simply
            too faint to be told apart from noise, which is also why a fifteenth of it survives an average.
          </p>
          <WorkedExample
            steps={[
              'Starting point: middle value = 908, robust spread (from the typical distance to the middle) = 7.4',
              'Pull in: the normal range is 908 ± 1.5 × 7.4, so the 985 is pulled in to about 921; the other fourteen are unchanged',
              'Tamed values → middle = 909.9, spread = 1.134 × their standard deviation = 7.4',
              'Limits on the ORIGINAL values: below 909.9 − 4 × 7.4 = 880.4, above 909.9 + 3 × 7.4 = 931.9',
              '985 is above the limit and is rejected. Second pass on the fourteen survivors: middle 909.0, spread 6.6, limits 882.5 to 928.9, nothing more rejected.',
            ]}
            explanation="Plain sky. The spread was measured on tamed values, so the trail could not inflate it, and 985 sits about ten spreads above the middle. Here kappa-sigma reached the same answer; the difference shows in smaller stacks."
          />
        </section>

        <section className="flex flex-col items-start gap-[24px]">
          <h2 className={h2}>Robust Chauvenet rejection</h2>
          <p className={bodyMd}>
            Chauvenet’s rule asks a different question. Given how many values there are and how spread out they normally are, how far
            from the middle would the most extreme value be expected to fall just by chance? If the most extreme value is further out
            than that, it is thrown out, and the question is asked again of the next most extreme. The version used here is robust:
            it runs three rounds, first with a middle and spread that ignore the extremes almost entirely, then with steadily more
            precise estimates, so a bright trail cannot hide inside the spread as it does in kappa-sigma clipping.
          </p>
          <p className={bodyMd}>
            It sets its own threshold from the number of frames, so there are no limits to choose by hand; the one setting is how
            unlikely a value must be before it goes, and WBPP uses 0.1. On the four-frame stack it rejected Frame 0003 at about 48 %
            of the trail pixels, far more than either clipping method, and with the fifteen frames below at about 46 %. The method
            wants 15 or more frames, because with few values its estimate of what is likely is itself uncertain.
          </p>
          <WorkedExample
            steps={[
              'Sort: 901, 903, 903, 904, 905, 905, 907, 908, 909, 913, 915, 916, 918, 920, 985. Round 1 uses the median as the middle, 908, and a spread from the smallest deviations only, 8.8',
              'The brightest, 985, is 8.7 spreads out. Among fifteen values, the expected number that far out by chance is effectively zero, far below the limit of 0.1: reject it',
              'Ask again of the fourteen that remain: the brightest, 920, has an expected count of 0.74 and the darkest, 901, of 2.80. Both are plausible, so round 1 ends',
              'Round 2 (same middle, a more precise spread of 6.7) and round 3 (middle = mean 909.1, spread = standard deviation 6.0): 920 has an expected count of 0.42, then 0.47, still above 0.1. Nothing more is rejected',
            ]}
            explanation="Plain sky, the same fourteen survivors as the two clipping methods. The method needed no limits chosen by hand: the limit of 0.1 and the count of fifteen decided how far out is too far."
          />
        </section>

        <section className="flex flex-col items-start gap-[24px]">
          <h2 className={h2}>The same region from fifteen frames</h2>
          <p className={bodyMd}>
            Here the satellite region is stacked from fifteen frames, Frames 0000 to 0014, once with each method. Frame 0003 is one of
            the fifteen, so an average keeps a fifteenth of the trail.
          </p>
          <div className="flex w-[1200px] flex-col items-start bg-surface-stage p-[24px]">
            <div className="grid grid-cols-2 gap-[24px]">
              {fifteenTiles.map((t) => (
                <figure key={t.caption} className="flex flex-col items-start gap-[12px]">
                  <img src={t.src} alt="" width={564} height={564} className="block size-[564px] object-cover" />
                  <figcaption className={`${bodySm} w-[564px] text-text-on-stage`}>{t.caption}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      </div>
    </LessonPage>
  );
}
