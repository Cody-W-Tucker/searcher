'use client';

import { TimingPhase } from '@/lib/types';
import { useEffect, useMemo, useState } from 'react';

const PHASE_ORDER = [
  'classification',
  'widget',
  'research',
  'writing',
  'total',
];

const formatDuration = (
  durationMs: number,
): { value: string; unit?: string } => {
  if (durationMs < 1000) {
    return { value: `${durationMs}`, unit: 'ms' };
  }

  if (durationMs < 10000) {
    return { value: `${(durationMs / 1000).toFixed(1)}`, unit: 's' };
  }

  return { value: `${Math.round(durationMs / 1000)}`, unit: 's' };
};

const getDurationMs = (phase: TimingPhase, now: number) => {
  if (typeof phase.durationMs === 'number') {
    return phase.durationMs;
  }

  if (phase.startedAt) {
    return Math.max(now - new Date(phase.startedAt).getTime(), 0);
  }

  return 0;
};

const getPhaseRank = (phase: TimingPhase) => {
  const phaseKey = phase.key.split(':')[0];
  const rank = PHASE_ORDER.indexOf(phaseKey);

  return rank === -1 ? PHASE_ORDER.length : rank;
};

const ResponseTiming = ({ phases }: { phases: TimingPhase[] }) => {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const hasRunningPhase = phases.some((phase) => phase.status === 'running');

    if (!hasRunningPhase) {
      return;
    }

    const interval = window.setInterval(() => setNow(Date.now()), 200);

    return () => window.clearInterval(interval);
  }, [phases]);

  const sortedPhases = useMemo(
    () =>
      [...phases].sort((a, b) => {
        const rankDiff = getPhaseRank(a) - getPhaseRank(b);

        if (rankDiff !== 0) {
          return rankDiff;
        }

        return a.label.localeCompare(b.label);
      }),
    [phases],
  );

  if (sortedPhases.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {sortedPhases.map((phase) => {
        const durationMs = getDurationMs(phase, now);
        const isRunning = phase.status === 'running';
        const isMuted = phase.status === 'skipped';

        return (
          <div
            key={phase.key}
            title={phase.detail || undefined}
            className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/70 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-black/70 backdrop-blur-sm dark:border-white/10 dark:bg-white/5 dark:text-white/70"
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${isRunning ? 'bg-emerald-500 animate-pulse' : isMuted ? 'bg-black/20 dark:bg-white/20' : phase.status === 'error' ? 'bg-rose-500' : 'bg-black/50 dark:bg-white/50'}`}
            />
            <span>{phase.label}</span>
            {isMuted ? (
              <span className="font-medium tracking-normal text-[12px] text-black dark:text-white">
                skip
              </span>
            ) : (
              <span className="font-medium tracking-normal text-[12px] text-black dark:text-white">
                {(() => {
                  const { value, unit } = formatDuration(durationMs);
                  return (
                    <>
                      {value}
                      {unit && (
                        <span className="text-black/50 dark:text-white/50 ml-0.5">
                          {unit}
                        </span>
                      )}
                    </>
                  );
                })()}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default ResponseTiming;
