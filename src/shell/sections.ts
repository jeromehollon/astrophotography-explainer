import type { ComponentType } from 'react';

/** One entry per app page. Section agents append exactly one line each (SPEC §4.6). */
export type Section = {
  path: string;            // hash route, e.g. '/calibration/bias'
  chapter: string;         // TopBar chapter label, e.g. 'Calibration'
  page: string;            // page label inside the chapter, e.g. 'Bias'
  Component: ComponentType;
};

import LightFramesReview from '../sections/light-frames-review';
import Workbench from '../sections/workbench';

export const sections: Section[] = [
  { path: '/light-frames/review', chapter: 'Light frames', page: 'Review the Exposures', Component: LightFramesReview },
  { path: '/workbench', chapter: 'Workbench', page: '', Component: Workbench },
];
