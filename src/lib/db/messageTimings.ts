import { and, eq, inArray } from 'drizzle-orm';
import db from '.';
import { messageTimings } from './schema';
import { Block, TimingBlock, TimingPhase } from '../types';

const isMissingMessageTimingsTableError = (error: unknown) => {
  return (
    error instanceof Error &&
    error.message.includes('no such table: message_timings')
  );
};

export const splitResponseBlocksAndTimings = (blocks: Block[]) => {
  const responseBlocks = blocks.filter((block) => block.type !== 'timing');
  const timingBlock = blocks.find(
    (block): block is TimingBlock => block.type === 'timing',
  );

  return {
    responseBlocks,
    timings: timingBlock?.data.phases || [],
  };
};

export const replaceMessageTimings = async (input: {
  chatId: string;
  messageId: string;
  timings: TimingPhase[];
}) => {
  try {
    await db
      .delete(messageTimings)
      .where(
        and(
          eq(messageTimings.chatId, input.chatId),
          eq(messageTimings.messageId, input.messageId),
        ),
      )
      .execute();

    if (input.timings.length === 0) {
      return;
    }

    const updatedAt = new Date().toISOString();

    await db.insert(messageTimings).values(
      input.timings.map((timing) => ({
        chatId: input.chatId,
        messageId: input.messageId,
        phaseKey: timing.key,
        label: timing.label,
        status: timing.status,
        startedAt: timing.startedAt || null,
        completedAt: timing.completedAt || null,
        durationMs: timing.durationMs ?? null,
        detail: timing.detail || null,
        updatedAt,
      })),
    );
  } catch (error) {
    if (!isMissingMessageTimingsTableError(error)) {
      throw error;
    }
  }
};

export const deleteMessageTimings = async (input: {
  chatId: string;
  messageIds?: string[];
}) => {
  if (input.messageIds && input.messageIds.length === 0) {
    return;
  }

  const whereClause = input.messageIds
    ? and(
        eq(messageTimings.chatId, input.chatId),
        inArray(messageTimings.messageId, input.messageIds),
      )
    : eq(messageTimings.chatId, input.chatId);

  try {
    await db.delete(messageTimings).where(whereClause).execute();
  } catch (error) {
    if (!isMissingMessageTimingsTableError(error)) {
      throw error;
    }
  }
};

export const getMessageTimingsByChatId = async (chatId: string) => {
  let timings;

  try {
    timings = await db.query.messageTimings.findMany({
      where: eq(messageTimings.chatId, chatId),
    });
  } catch (error) {
    if (isMissingMessageTimingsTableError(error)) {
      return {};
    }

    throw error;
  }

  return timings.reduce<Record<string, TimingPhase[]>>((acc, timing) => {
    if (!acc[timing.messageId]) {
      acc[timing.messageId] = [];
    }

    acc[timing.messageId].push({
      key: timing.phaseKey,
      label: timing.label,
      status: timing.status,
      startedAt: timing.startedAt || undefined,
      completedAt: timing.completedAt || undefined,
      durationMs: timing.durationMs ?? undefined,
      detail: timing.detail || undefined,
    });
    return acc;
  }, {});
};
