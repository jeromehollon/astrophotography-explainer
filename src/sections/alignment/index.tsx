// P6 Alignment (Figma frame 73:2). Reading-only: SNR chart, why-stack prose + aside, two equation rows.
import { LessonPage, Reading, PageHead, Prose, Callout } from '../lessons-a-shim/ui';
import '../lessons-a-shim/prose.css';
import frame05 from './assets/frame05.png';
import frame02 from './assets/frame02.png';
import frame02Aligned from './assets/frame02_aligned.png';
import naiveAverage from './assets/naive_average.png';
import alignedAverage from './assets/aligned_average.png';
import { SnrChart } from './SnrChart';

// Alignment stars in the 1200×800 crop (assets/alignment/stats.json → alignment_stars_crop_px), scaled to the 330×220 well.
const STARS: [number, number][] = [
  [404.9, 673.1],
  [245.9, 411.6],
  [1064.2, 673.6],
].map(([x, y]) => [(x * 330) / 1200, (y * 220) / 800]);

function Tile({ src, caption, circles = false }: { src: string; caption: string; circles?: boolean }) {
  return (
    <figure className="flex flex-col items-start gap-[12px]">
      <div className="relative h-[220px] w-[330px] overflow-hidden">
        <img src={src} alt="" className="block h-[220px] w-[330px] object-cover" />
        {circles && (
          <svg className="absolute inset-0" width="330" height="220" viewBox="0 0 330 220" aria-hidden="true">
            {STARS.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="11" stroke="#C8321F" strokeWidth="2" fill="none" />)}
          </svg>
        )}
      </div>
      <figcaption className="cap-on-stage w-[330px]">{caption}</figcaption>
    </figure>
  );
}

function Op({ children }: { children: string }) {
  return (
    <div className="flex h-[220px] w-[33px] flex-col items-center justify-center">
      <span className="font-heading text-[28px] leading-[34px] font-semibold text-text-on-stage">{children}</span>
    </div>
  );
}

export default function Alignment() {
  return (
    <LessonPage>
      <Reading>
        <PageHead
          eyebrow="Chapter 5 · Alignment"
          title="Bringing the same stars together"
          lede="Stacking means averaging many exposures of the same target into one image. Averaging quiets the random noise while the light of the galaxy stays put, which is why we collect more than one photograph. It only works if the same star sits on the same pixel in every exposure, and straight from the camera it does not. This page shows why more exposures help, what goes wrong when they are averaged as they are, and how lining them up by their stars fixes it."
        />

        <SnrChart />

        <div className="flex items-start gap-[48px]">
          <Prose>
            <h2>Why collect more than one photograph?</h2>
            <p>The faint light from a galaxy is the signal we want to keep. Random noise makes the measured brightness of every pixel fluctuate from one exposure to the next. The signal-to-noise ratio, or SNR, compares the strength of the useful signal with the size of those fluctuations. The higher the ratio, the easier faint structure is to tell apart from the grain around it.</p>
            <p>When we average exposures of the same quality, the galaxy keeps the same average brightness while the random fluctuations shrink. The improvement follows a square root: four photographs give about twice the SNR of one, sixteen give four times, and sixty-four give eight times. Each further doubling of the SNR takes four times as many photographs. The graph above shows both halves of that trade, the noise falling and the signal standing out more.</p>
          </Prose>
          <Callout kind="why" title="Where the square root comes from" className="w-[440px] shrink-0">
            {'If we add N equal exposures, the useful signal grows N times. Independent random noise adds differently: square each noise value, add the squares, then take the square root. For equally noisy exposures that makes the total noise grow √N times. Dividing signal by noise leaves an improvement of N ÷ √N = √N.\n\nFor example, a signal of 100 and a noise of 10 give an SNR of 10 in one exposure. Adding four such exposures gives a signal of 400 and a noise of 20, so the SNR is 20. Averaging divides both totals by four and leaves the ratio unchanged. These numbers are illustrative.'}
          </Callout>
        </div>

        <div className="flex flex-col items-start gap-[24px]">
          <Prose>
            <h2>The problem you can see</h2>
            <p>These are the two exposures with the largest position difference in our set, after putting both in the same orientation. Look at the bright star beside the galaxy. It falls in a different place in each photograph. If we average the images as they are, we keep both misplaced copies of the star and give the galaxy a second, overlapping center.</p>
          </Prose>
          <div className="flex flex-col items-start rounded-[6px] bg-surface-stage p-[24px]">
            <div className="flex items-start gap-[24px]">
              <Tile src={frame05} caption="Frame 5" />
              <Op>+</Op>
              <Tile src={frame02} caption="Frame 2" />
              <Op>=</Op>
              <Tile src={naiveAverage} caption="Average, not aligned" />
            </div>
          </div>
        </div>

        <div className="flex flex-col items-start gap-[24px]">
          <Prose>
            <h2>Use the stars to bring the views together</h2>
            <p>The red circles mark three examples of the same stars in the two photographs. Alignment software compares patterns of matching stars across the image, then shifts and rotates each exposure onto a shared grid. This process is also called registration. Now a given position refers to the same piece of sky in both images, so averaging reinforces the galaxy and its stars in the right places.</p>
          </Prose>
          <div className="flex flex-col items-start rounded-[6px] bg-surface-stage p-[24px]">
            <div className="flex items-start gap-[24px]">
              <Tile src={frame05} caption="Frame 5. Alignment stars circled." circles />
              <Op>+</Op>
              <Tile src={frame02Aligned} caption="Frame 2, moved to match frame 5." circles />
              <Op>=</Op>
              <Tile src={alignedAverage} caption="Average after alignment, note the smoother background, this is why we stack. What’s not apparent yet is the increase in signal in the galaxy. Stack more to see this." />
            </div>
          </div>
        </div>
      </Reading>
    </LessonPage>
  );
}
