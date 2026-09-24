import type { ComponentType } from 'react';

/** One entry per app page. Section agents append exactly one line each (SPEC §4.6). */
export type Section = {
  path: string;            // hash route, e.g. '/calibration/bias'
  chapter: string;         // TopBar chapter label, e.g. 'Calibration'
  page: string;            // page label inside the chapter, e.g. 'Bias'
  Component: ComponentType;
};

export const sections: Section[] = [];
