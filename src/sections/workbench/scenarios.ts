/** Workbench scenarios (SPEC §7 P9 table). Each button sets the whole store in one click. */
import type { AlgorithmName, CalibrationChoice } from './store';

export type Scenario = {
  id: 'default' | 'naive' | 'satellite' | 'cloud' | 'tracking';
  label: string;
  /** Prose under the buttons: the first line is the name, the rest the description (Figma 127:1072). */
  description: string;
  frames: string[];
  algorithm: AlgorithmName;
  calibration: CalibrationChoice;
};

export const RAW_FRAMES = Array.from({ length: 20 }, (_, i) => `f${String(i).padStart(2, '0')}`);
export const VARIANT_FRAMES = ['f11_tracking', 'f14_cloud', 'f15_cloud', 'f16_cloud'];
export const ALL_FRAMES = [...RAW_FRAMES, ...VARIANT_FRAMES];

const FULL: CalibrationChoice = { bias: true, dark: true, darkFlat: true, flat: 50 };

export const SCENARIOS: Scenario[] = [
  {
    id: 'default',
    label: 'Default',
    description:
      'The twenty photographs as they were taken, none of the altered copies, combined with the median. Every calibration frame is applied. Frame 0003 with its satellite trail is included.',
    frames: [...RAW_FRAMES],
    algorithm: 'median',
    calibration: FULL,
  },
  {
    id: 'naive',
    label: 'Naive',
    description:
      'All twenty-four entries, the altered copies included, combined with the average. Every calibration frame is applied. Nothing is rejected, so every defect ends up in the master.',
    frames: [...ALL_FRAMES],
    algorithm: 'average',
    calibration: FULL,
  },
  {
    id: 'satellite',
    label: 'Satellite Trail Challenge',
    description:
      'Frame 0003 with its satellite trail plus four of the sharpest photographs, 0002, 0004, 0005 and 0007, combined with the average. Every calibration frame is applied. Can a method remove the trail from five photographs?',
    frames: ['f03', 'f02', 'f04', 'f05', 'f07'],
    algorithm: 'average',
    calibration: FULL,
  },
  {
    id: 'cloud',
    label: 'Cloud Challenge',
    description:
      'The three cloud copies of 0014, 0015 and 0016 plus two clear photographs, 0009 and 0013, combined with the average. Every calibration frame is applied. Three of the five photographs are the bad ones.',
    frames: ['f14_cloud', 'f15_cloud', 'f16_cloud', 'f09', 'f13'],
    algorithm: 'average',
    calibration: FULL,
  },
  {
    id: 'tracking',
    label: 'Tracking Error Challenge',
    description:
      'The tracking error copy of 0011 plus two sharp photographs, 0009 and 0013, combined with the average. Every calibration frame is applied. Trailed stars in one of three photographs.',
    frames: ['f11_tracking', 'f09', 'f13'],
    algorithm: 'average',
    calibration: FULL,
  },
];

const sameSet = (a: string[], b: string[]) => a.length === b.length && [...a].sort().join() === [...b].sort().join();
const sameCal = (a: CalibrationChoice, b: CalibrationChoice) => a.bias === b.bias && a.dark === b.dark && a.darkFlat === b.darkFlat && a.flat === b.flat;

/** The scenario whose definition matches the current state, if any. */
export function matchScenario(frames: string[], algorithm: AlgorithmName, calibration: CalibrationChoice): Scenario | undefined {
  return SCENARIOS.find((s) => s.algorithm === algorithm && sameCal(s.calibration, calibration) && sameSet(s.frames, frames));
}
