// The Alignment illustration (Figma 75:91): two drawn panels, 1/√N noise and √N signal, N = 1…64.
// Geometry copied from Figma; the curves are generated from the same formulas the design used.

const N_MAX = 64;
const PLOT_W = 400;

function pathFor(fn: (n: number) => number): string {
  const pts: string[] = [];
  for (let i = 0; i <= 250; i++) {
    const n = 1 + ((N_MAX - 1) * i) / 250;
    const x = ((n - 1) / (N_MAX - 1)) * PLOT_W;
    pts.push(`${i === 0 ? 'M' : 'L'}${x.toFixed(2)} ${fn(n).toFixed(2)}`);
  }
  return pts.join('');
}

// Local plot coordinates (0,0 = top-left of the 400×175 curve box at panel (80,56)).
const noiseY = (n: number) => 200 - 200 / Math.sqrt(n);
const snrY = (n: number) => 200 - 25 * Math.sqrt(n);

type PanelProps = {
  left: number;
  title: string;
  color: string;
  fn: (n: number) => number;
  yLabels: [string, string, string, string]; // for N = 1, 4, 16, 64 in that order
};

const N_MARKS = [1, 4, 16, 64];
// Tick labels for N = 1 and 4 are nudged apart in the design (centres 66 and 113.05 instead of 80 and 99.05).
const X_LABEL_CENTRE = [66, 113.05, 175.24, 480];

function Panel({ left, title, color, fn, yLabels }: PanelProps) {
  return (
    <div className="absolute top-0 h-[360px] w-[560px]" style={{ left }}>
      <p className="absolute top-[8px] left-[80px] font-heading text-[22px] leading-[28px] font-medium whitespace-nowrap text-text-primary">{title}</p>
      <svg className="absolute top-0 left-0" width="560" height="360" viewBox="0 0 560 360" aria-hidden="true">
        <rect x="80" y="256" width="400" height="2" fill="#1C1A17" />
        <rect x="80" y="56" width="2" height="200" fill="#1C1A17" />
        <g transform="translate(80 56)">
          <path d={pathFor(fn)} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" />
        </g>
        {N_MARKS.map((n) => {
          const x = 80 + ((n - 1) / (N_MAX - 1)) * PLOT_W;
          const y = 56 + fn(n);
          return (
            <g key={n}>
              <circle cx={x} cy={y} r="6" fill={color} />
              <rect x={x - 1} y="256" width="2" height="6" fill="#1C1A17" />
              <rect x="74" y={y - 1} width="6" height="2" fill="#1C1A17" />
            </g>
          );
        })}
      </svg>
      {N_MARKS.map((n, i) => (
        <p key={n} className="absolute top-[264px] w-[40px] -translate-x-1/2 text-center font-mono text-[12px] leading-[16px] text-text-primary" style={{ left: X_LABEL_CENTRE[i] }}>{n}</p>
      ))}
      {N_MARKS.map((n, i) => (
        <p key={n} className="absolute left-[16px] w-[56px] text-right font-mono text-[12px] leading-[16px] text-text-primary" style={{ top: 56 + fn(n) - 8 }}>{yLabels[i]}</p>
      ))}
      <p className="absolute top-[286px] left-[80px] w-[400px] text-center font-body text-[14px] leading-[20px] font-medium text-text-primary">Exposures averaged</p>
    </div>
  );
}

export function SnrChart() {
  return (
    <div className="relative h-[360px] w-[1200px]" role="img" aria-label="Two charts: random noise in the final image falls as one over the square root of the number of exposures averaged; signal from the galaxy rises as the square root.">
      <Panel left={40} title="Random noise present in final image" color="#8B8B8B" fn={noiseY} yLabels={['1', '1/2', '1/4', '1/8']} />
      <Panel left={640} title="Signal from galaxy in the image" color="#1F4AA8" fn={snrY} yLabels={['1×', '2×', '4×', '8×']} />
    </div>
  );
}
