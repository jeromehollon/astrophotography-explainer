/** Static facts and bundled assets for the light-frame list, the viewer and the workbench tables. */
import reviewStats from '../../../assets/light-frames-review/stats.json';
import workbenchStats from '../../../assets/workbench/stats.json';
import { ALL_FRAMES } from './scenarios';

export const SENSOR = { w: 6224, h: 4168 };
export const REFERENCE = 'f03';

export type RoiKey = 'trail' | 'galaxy' | 'group' | 'mote';
export const ROI_KEYS: RoiKey[] = ['trail', 'galaxy', 'group', 'mote'];
export type Rect = { x: number; y: number; w: number; h: number };

/** design-notes §5 item 29: reference-frame (f03) sensor coordinates, 1440×960 native, shown at bin 2. */
/** Snapped to even x, y so the rect is a multiple of bin 2 (the mote's 2397 − 480 = 1917 would be odd). */
const centred = (cx: number, cy: number, w: number, h: number): Rect => ({ x: 2 * Math.floor((cx - w / 2) / 2), y: 2 * Math.floor((cy - h / 2) / 2), w, h });
export const ROIS: Record<RoiKey, { title: string; rect: Rect }> = {
  trail: { title: 'Satellite trail', rect: centred(4760, 2850, 1440, 960) },
  galaxy: { title: 'Central galaxy', rect: centred(3246, 2100, 1440, 960) },
  group: { title: 'Galaxy group', rect: centred(3480, 2860, 1440, 960) },
  mote: { title: 'Dust mote', rect: centred(760, 2397, 1440, 960) },
};
/** The wide galaxy view on the review page: 2400×1800 native at bin 2. */
export const WIDE_RECT: Rect = centred(3246, 2100, 2400, 1800);

type ReviewFrame = (typeof reviewStats)['frames'][keyof (typeof reviewStats)['frames']];
export type FrameInfo = {
  id: string;
  number: string; // '0003'
  pierSide: 'West' | 'East';
  variantOf: string | null;
  defect: string;
  fwhmPx: number;
  fwhmShown: string;
  note: string;
  histogramBars: number[]; // 96 bar heights in px (0..34)
};

const NOTE: Record<string, string> = {
  satellite: 'Satellite trail',
  tracking: 'Tracking error example',
  cloud: 'Cloud cover example',
};

export const FRAMES: FrameInfo[] = ALL_FRAMES.map((id) => {
  const f = (reviewStats.frames as Record<string, ReviewFrame>)[id];
  return {
    id,
    number: f.framecard.number_shown,
    pierSide: f.pier_side as 'West' | 'East',
    variantOf: f.variant_of,
    defect: f.defect,
    fwhmPx: f.fwhm_px,
    fwhmShown: f.framecard.fwhm_shown,
    note: NOTE[f.defect] ?? '',
    histogramBars: f.framecard.histogram_bars_px,
  };
});
export const FRAME_BY_ID = Object.fromEntries(FRAMES.map((f) => [f.id, f])) as Record<string, FrameInfo>;

/** Design-time stretch of the review assets (reference frame, full calibration). */
export const FALLBACK_STF = reviewStats.stf;

/* Bundled PNGs (assets/ is committed next to Figma; Vite hashes them). */
const thumbs = import.meta.glob('../../../assets/light-frames-review/frames/*_thumb.png', { eager: true, import: 'default' }) as Record<string, string>;
const fulls = import.meta.glob('../../../assets/light-frames-review/frames/*_full.png', { eager: true, import: 'default' }) as Record<string, string>;
const rois = import.meta.glob('../../../assets/light-frames-review/frames/*_roi_*.png', { eager: true, import: 'default' }) as Record<string, string>;
const stacks = import.meta.glob('../../../assets/light-frames-review/stack_*.png', { eager: true, import: 'default' }) as Record<string, string>;
const cals = import.meta.glob('../../../assets/workbench/cal_*.png', { eager: true, import: 'default' }) as Record<string, string>;
/** The Figma P9 frame (127:1251) shows the dark flat with its own AutoSTF, darker than assets/workbench/cal_darkflat.png; bundled from Figma. */
import figmaDarkflat from './assets/cal_darkflat.png';

const pick = (map: Record<string, string>, name: string) => map[Object.keys(map).find((k) => k.endsWith(`/${name}`)) ?? ''] ?? '';
export const thumbSrc = (id: string) => pick(thumbs, `${id}_thumb.png`);
export const fullSrc = (id: string) => pick(fulls, `${id}_full.png`);
export const roiSrc = (id: string, roi: RoiKey) => pick(rois, `${id}_roi_${roi}.png`);
export const stackSrc = (region: RoiKey | 'wide', method: 'average' | 'median') => pick(stacks, `stack_${region}_${method}.png`);
export const calSrc = (name: 'bias' | 'dark' | 'darkflat' | 'flat_10' | 'flat_50' | 'flat_85') => (name === 'darkflat' ? figmaDarkflat : pick(cals, `cal_${name}.png`));

/** 128-bin full-range histograms of the masters, as drawn in Figma: bar height = round(100·count/max). */
export function masterHistogram(name: keyof (typeof workbenchStats)['masters']): number[] {
  const counts = workbenchStats.masters[name].histogram.counts as number[];
  const max = Math.max(...counts);
  return counts.map((c) => Math.round((100 * c) / max));
}

const WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty', 'twenty-one', 'twenty-two', 'twenty-three', 'twenty-four'];
export const countWord = (n: number) => WORDS[n] ?? String(n);

export const METHOD_LABEL: Record<string, string> = {
  average: 'Average',
  median: 'Median',
  kappaSigma: 'Kappa-sigma clipping',
  winsorized: 'Winsorized sigma clipping',
  rcr: 'Robust Chauvenet rejection',
};
