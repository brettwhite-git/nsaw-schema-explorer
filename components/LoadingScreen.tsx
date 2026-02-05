import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Database } from 'lucide-react';

interface LoadingScreenProps {
  message?: string;
  error?: string | null;
}

// ─── Unicode box-drawing infinity symbol ─────────────────────────────────────
// 5 rows tall, 25 chars wide. Uses rounded corners (╭╮╰╯), box-drawing
// diagonals (╱╲), horizontal (─), vertical (│), and cross (╳).
// These render smoothly in JetBrains Mono with no visual gaps at corners.
//
//  Col: 0         1         2
//       0123456789012345678901234
//  R0:  "   ╭──────╮   ╭──────╮   "
//  R1:  "  ╱        ╲ ╱        ╲  "
//  R2:  " │          ╳          │ "
//  R3:  "  ╲        ╱ ╲        ╱  "
//  R4:  "   ╰──────╯   ╰──────╯   "

const INF_ART = [
  '   ╭──────╮   ╭──────╮   ',
  '  ╱        ╲ ╱        ╲  ',
  ' │          ╳          │ ',
  '  ╲        ╱ ╲        ╱  ',
  '   ╰──────╯   ╰──────╯   ',
];

// ─── Trace path: [row, col] coordinates ──────────────────────────────────────
// Continuous figure-8 tracing the ∞ outline.
// Flow: right │ → up → top of right loop (left) → cross center (left) →
//       top of left loop (left) → down left side → bottom of left loop (right) →
//       cross center (right) → bottom of right loop (right) → up right side → repeat
//
// Every non-space character is visited exactly once per half-cycle (center ╳ twice).
// 46 total steps → ~3.7s per loop at 80ms/frame.

const TRACE_PATH: [number, number][] = [
  // Right side of right loop, going UP
  [2, 23],
  [1, 22],
  // Top of right loop, going LEFT
  [0, 21], [0, 20], [0, 19], [0, 18], [0, 17], [0, 16], [0, 15], [0, 14],
  // Down-left into center
  [1, 13],
  // Cross center going LEFT
  [2, 12],
  // Up-left out of center
  [1, 11],
  // Top of left loop, going LEFT
  [0, 10], [0, 9], [0, 8], [0, 7], [0, 6], [0, 5], [0, 4], [0, 3],
  // Left side of left loop, going DOWN
  [1, 2],
  [2, 1],
  [3, 2],
  // Bottom of left loop, going RIGHT
  [4, 3], [4, 4], [4, 5], [4, 6], [4, 7], [4, 8], [4, 9], [4, 10],
  // Up-right into center
  [3, 11],
  // Cross center going RIGHT
  [2, 12],
  // Down-right out of center
  [3, 13],
  // Bottom of right loop, going RIGHT
  [4, 14], [4, 15], [4, 16], [4, 17], [4, 18], [4, 19], [4, 20], [4, 21],
  // Right side of right loop, going UP
  [3, 22],
  // wraps → [2, 23] at index 0
];

const PATH_LENGTH = TRACE_PATH.length;
const FRAME_MS = 10;          // 100fps tick rate
const STEPS_PER_TICK = 3;    // advance 3 positions per tick → full loop in ~150ms
const TRAIL_LENGTH = 10;      // wide sweep visible even at high speed
const TRAIL_OPACITIES = [1.0, 0.9, 0.75, 0.6, 0.45, 0.32, 0.22, 0.14, 0.08, 0.03];

// ─── Components ──────────────────────────────────────────────────────────────

export const LoadingScreen: React.FC<LoadingScreenProps> = ({
  message = 'Loading NSAW Lineage Data...',
  error,
}) => {
  const [retryHovered, setRetryHovered] = useState(false);

  if (error) {
    return (
      <div
        className="fixed inset-0 flex items-center justify-center z-50"
        style={{ backgroundColor: 'var(--theme-bg-base)' }}
      >
        <div className="text-center">
          <div
            className="p-4 rounded-xl border mb-6"
            style={{
              backgroundColor: 'var(--theme-accent-red-bg)',
              borderColor: 'var(--theme-accent-red-border)',
            }}
          >
            <Database className="w-16 h-16 mx-auto" style={{ color: 'var(--theme-accent-red-text)' }} />
          </div>
          <h2
            className="text-xl font-bold mb-2"
            style={{ color: 'var(--theme-text-primary)' }}
          >
            Failed to Load Data
          </h2>
          <p
            className="text-sm max-w-md"
            style={{ color: 'var(--theme-accent-red-text)' }}
          >
            {error}
          </p>
          <button
            onClick={() => window.location.reload()}
            onMouseEnter={() => setRetryHovered(true)}
            onMouseLeave={() => setRetryHovered(false)}
            className="mt-6 px-4 py-2 rounded-md text-sm font-medium transition-colors"
            style={{
              backgroundColor: retryHovered ? 'var(--theme-accent-cyan)' : 'var(--theme-accent-cyan-dark)',
              color: 'var(--theme-text-primary)',
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return <InfinityLoader message={message} />;
};

// Separate component so hooks are not conditional
const InfinityLoader: React.FC<{ message: string }> = ({ message }) => {
  const [frame, setFrame] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setFrame((f) => (f + STEPS_PER_TICK) % PATH_LENGTH);
    }, FRAME_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Build the grid with tracer highlighting for current frame
  const grid = useMemo(() => {
    // Build tracer map: "row,col" → opacity for highlighted positions
    const tracerMap = new Map<string, number>();
    for (let i = 0; i < TRAIL_LENGTH; i++) {
      const idx = (frame - i + PATH_LENGTH) % PATH_LENGTH;
      const [r, c] = TRACE_PATH[idx];
      const key = `${r},${c}`;
      // Head has priority — only set if not already claimed by a closer position
      if (!tracerMap.has(key)) {
        tracerMap.set(key, TRAIL_OPACITIES[i]);
      }
    }

    return INF_ART.map((line, row) => (
      <div key={row}>
        {[...line].map((char, col) => {
          const key = `${row},${col}`;
          const tracerOpacity = tracerMap.get(key);
          if (tracerOpacity !== undefined) {
            return (
              <span
                key={col}
                style={{
                  color: 'var(--theme-accent-cyan-text)',
                  opacity: tracerOpacity,
                }}
              >
                {char}
              </span>
            );
          } else if (char !== ' ') {
            return (
              <span key={col} style={{ color: 'var(--theme-text-faint)' }}>
                {char}
              </span>
            );
          } else {
            return <span key={col}> </span>;
          }
        })}
      </div>
    ));
  }, [frame]);

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ backgroundColor: 'var(--theme-bg-base)' }}
    >
      <div className="text-center flex flex-col items-center">
        <pre
          className="mb-6 leading-tight select-none"
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '16px',
            lineHeight: '1.3',
          }}
          aria-hidden="true"
        >
          {grid}
        </pre>

        <h1
          className="text-lg font-semibold mb-2 tracking-tight"
          style={{ color: 'var(--theme-text-primary)' }}
        >
          NSAW
        </h1>
        <p
          className="text-sm mb-4"
          style={{ color: 'var(--theme-text-tertiary)' }}
        >
          {message}
        </p>
        <p
          className="text-xs"
          style={{ color: 'var(--theme-text-faint)' }}
        >
          Indexing 56,000+ field mappings...
        </p>
      </div>
    </div>
  );
};
