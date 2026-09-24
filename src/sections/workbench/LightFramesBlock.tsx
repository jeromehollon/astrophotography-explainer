/** The two-column light-frames block shared by the review page and the workbench. */
import { useState } from 'react';
import { FrameList } from './FrameList';
import { FrameViewer } from './FrameViewer';
import { useAppStore } from './store';
import { REFERENCE } from './data';

export function LightFramesBlock() {
  const frames = useAppStore((s) => s.frames);
  const calibration = useAppStore((s) => s.calibration);
  const set = useAppStore((s) => s.set);
  const [current, setCurrent] = useState(REFERENCE);
  const toggle = (id: string, on: boolean) => set({ frames: on ? (frames.includes(id) ? frames : [...frames, id]) : frames.filter((f) => f !== id) });
  return (
    <div className="flex w-[1200px] items-start gap-6">
      <FrameList selected={frames} onToggle={toggle} current={current} onView={setCurrent} />
      <FrameViewer current={current} onChange={setCurrent} calibration={calibration} />
    </div>
  );
}
