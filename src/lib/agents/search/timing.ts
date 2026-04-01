import SessionManager from '@/lib/session';
import { TimingBlock, TimingPhase } from '@/lib/types';

const getTimingBlock = (session: SessionManager, blockId: string) => {
  const block = session.getBlock(blockId);

  if (!block || block.type !== 'timing') {
    return null;
  }

  return block as TimingBlock;
};

const updateTimingPhases = (
  session: SessionManager,
  blockId: string,
  updater: (phases: TimingPhase[]) => TimingPhase[],
) => {
  const block = getTimingBlock(session, blockId);

  if (!block) {
    return;
  }

  block.data.phases = updater([...block.data.phases]);

  session.updateBlock(blockId, [
    {
      op: 'replace',
      path: '/data/phases',
      value: block.data.phases,
    },
  ]);
};

export const createTimingBlock = (session: SessionManager) => {
  const blockId = crypto.randomUUID();

  session.emitBlock({
    id: blockId,
    type: 'timing',
    data: {
      phases: [],
    },
  });

  return blockId;
};

export const startTimingPhase = (
  session: SessionManager,
  blockId: string,
  key: string,
  label: string,
) => {
  updateTimingPhases(session, blockId, (phases) => {
    const startedAt = new Date().toISOString();
    const existingIndex = phases.findIndex((phase) => phase.key === key);
    const nextPhase: TimingPhase = {
      key,
      label,
      status: 'running',
      startedAt,
    };

    if (existingIndex === -1) {
      phases.push(nextPhase);
    } else {
      phases[existingIndex] = {
        ...phases[existingIndex],
        ...nextPhase,
        completedAt: undefined,
        durationMs: undefined,
        detail: undefined,
      };
    }

    return phases;
  });
};

export const finishTimingPhase = (
  session: SessionManager,
  blockId: string,
  key: string,
  status: TimingPhase['status'] = 'completed',
  detail?: string,
) => {
  updateTimingPhases(session, blockId, (phases) => {
    const completedAt = new Date().toISOString();
    const existingIndex = phases.findIndex((phase) => phase.key === key);

    if (existingIndex === -1) {
      phases.push({
        key,
        label: key,
        status,
        completedAt,
        durationMs: 0,
        detail,
      });

      return phases;
    }

    const existingPhase = phases[existingIndex];
    const durationMs = existingPhase.startedAt
      ? Math.max(
          new Date(completedAt).getTime() -
            new Date(existingPhase.startedAt).getTime(),
          0,
        )
      : existingPhase.durationMs || 0;

    phases[existingIndex] = {
      ...existingPhase,
      status,
      completedAt,
      durationMs,
      detail,
    };

    return phases;
  });
};

export const skipTimingPhase = (
  session: SessionManager,
  blockId: string,
  key: string,
  label: string,
  detail?: string,
) => {
  updateTimingPhases(session, blockId, (phases) => {
    const existingIndex = phases.findIndex((phase) => phase.key === key);
    const skippedPhase: TimingPhase = {
      key,
      label,
      status: 'skipped',
      durationMs: 0,
      detail,
    };

    if (existingIndex === -1) {
      phases.push(skippedPhase);
    } else {
      phases[existingIndex] = {
        ...phases[existingIndex],
        ...skippedPhase,
      };
    }

    return phases;
  });
};
