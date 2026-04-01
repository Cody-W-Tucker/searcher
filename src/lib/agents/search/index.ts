import { ResearcherOutput, SearchAgentInput } from './types';
import SessionManager from '@/lib/session';
import { classify } from './classifier';
import Researcher from './researcher';
import { getWriterPrompt } from '@/lib/prompts/search/writer';
import { WidgetExecutor } from './widgets';
import { buildWriterContext, createSpeedModeClassification } from './helpers';
import {
  createTimingBlock,
  finishTimingPhase,
  skipTimingPhase,
  startTimingPhase,
} from './timing';
import db from '@/lib/db';
import {
  deleteMessageTimings,
  replaceMessageTimings,
  splitResponseBlocksAndTimings,
} from '@/lib/db/messageTimings';
import { messages } from '@/lib/db/schema';
import { and, eq, gt } from 'drizzle-orm';
import { TextBlock } from '@/lib/types';

const getWidgetTimingLabel = (type: string) => {
  switch (type) {
    case 'stock':
      return 'Stock Widget';
    case 'calculation':
      return 'Calculation Widget';
    default:
      return type
        .split(/[_-]/g)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
  }
};

const createPersistenceManager = (
  session: SessionManager,
  input: Pick<SearchAgentInput, 'chatId' | 'messageId'>,
) => {
  let persistTimeout: ReturnType<typeof setTimeout> | null = null;
  let persistPromise: Promise<void> = Promise.resolve();

  const persist = (
    status: 'answering' | 'completed' | 'error' = 'answering',
  ) => {
    persistPromise = persistPromise
      .catch(() => {})
      .then(async () => {
        const { responseBlocks, timings } = splitResponseBlocksAndTimings(
          session.getAllBlocks(),
        );

        await db
          .update(messages)
          .set({
            status,
            responseBlocks,
          })
          .where(
            and(
              eq(messages.chatId, input.chatId),
              eq(messages.messageId, input.messageId),
            ),
          )
          .execute();

        await replaceMessageTimings({
          chatId: input.chatId,
          messageId: input.messageId,
          timings,
        });
      });

    return persistPromise;
  };

  const schedulePersist = () => {
    if (persistTimeout) {
      clearTimeout(persistTimeout);
    }

    persistTimeout = setTimeout(() => {
      persistTimeout = null;
      void persist('answering');
    }, 250);
  };

  const flush = async (status: 'answering' | 'completed' | 'error') => {
    if (persistTimeout) {
      clearTimeout(persistTimeout);
      persistTimeout = null;
    }

    await persist(status);
  };

  const unsubscribe = session.subscribe((event) => {
    if (event === 'data') {
      schedulePersist();
    }
  });

  return {
    flush,
    dispose: () => {
      if (persistTimeout) {
        clearTimeout(persistTimeout);
        persistTimeout = null;
      }

      unsubscribe();
    },
  };
};

class SearchAgent {
  async searchAsync(session: SessionManager, input: SearchAgentInput) {
    const exists = await db.query.messages.findFirst({
      where: and(
        eq(messages.chatId, input.chatId),
        eq(messages.messageId, input.messageId),
      ),
    });

    if (!exists) {
      await deleteMessageTimings({
        chatId: input.chatId,
        messageIds: [input.messageId],
      });

      await db.insert(messages).values({
        chatId: input.chatId,
        messageId: input.messageId,
        backendId: session.id,
        query: input.followUp,
        createdAt: new Date().toISOString(),
        status: 'answering',
        responseBlocks: [],
      });
    } else {
      const laterMessages = await db.query.messages.findMany({
        where: and(
          eq(messages.chatId, input.chatId),
          gt(messages.id, exists.id),
        ),
        columns: {
          messageId: true,
        },
      });

      await deleteMessageTimings({
        chatId: input.chatId,
        messageIds: [
          input.messageId,
          ...laterMessages.map((message) => message.messageId),
        ],
      });

      await db
        .delete(messages)
        .where(
          and(eq(messages.chatId, input.chatId), gt(messages.id, exists.id)),
        )
        .execute();
      await db
        .update(messages)
        .set({
          status: 'answering',
          backendId: session.id,
          responseBlocks: [],
        })
        .where(
          and(
            eq(messages.chatId, input.chatId),
            eq(messages.messageId, input.messageId),
          ),
        )
        .execute();
    }

    const persistence = createPersistenceManager(session, input);

    try {
      const timingBlockId = createTimingBlock(session);
      startTimingPhase(session, timingBlockId, 'total', 'Total');
      const isSpeedMode = input.config.mode === 'speed';

      const classification = isSpeedMode
        ? createSpeedModeClassification(input.followUp)
        : await (async () => {
            startTimingPhase(
              session,
              timingBlockId,
              'classification',
              'Classify',
            );

            const result = await classify({
              chatHistory: input.chatHistory,
              enabledSources: input.config.sources,
              query: input.followUp,
              llm: input.config.llm,
            });

            finishTimingPhase(session, timingBlockId, 'classification');

            return result;
          })();

      const widgetPromise = isSpeedMode
        ? Promise.resolve([])
        : WidgetExecutor.executeAll(
            {
              classification,
              chatHistory: input.chatHistory,
              followUp: input.followUp,
              llm: input.config.llm,
            },
            {
              onWidgetStart: (type) => {
                startTimingPhase(
                  session,
                  timingBlockId,
                  `widget:${type}`,
                  getWidgetTimingLabel(type),
                );
              },
              onWidgetComplete: (type) => {
                finishTimingPhase(session, timingBlockId, `widget:${type}`);
              },
              onWidgetError: (type) => {
                finishTimingPhase(
                  session,
                  timingBlockId,
                  `widget:${type}`,
                  'error',
                  'Widget failed',
                );
              },
            },
          ).then((widgetOutputs) => {
            widgetOutputs.forEach((o) => {
              session.emitBlock({
                id: crypto.randomUUID(),
                type: 'widget',
                data: {
                  widgetType: o.type,
                  params: o.data,
                },
              });
            });
            return widgetOutputs;
          });

      let searchPromise: Promise<ResearcherOutput> | null = null;

      if (!classification.classification.skipSearch) {
        startTimingPhase(session, timingBlockId, 'research', 'Research');
        const researcher = new Researcher();
        searchPromise = researcher
          .research(session, {
            chatHistory: input.chatHistory,
            followUp: input.followUp,
            classification: classification,
            config: input.config,
          })
          .then((result) => {
            finishTimingPhase(session, timingBlockId, 'research');
            return result;
          });
      } else {
        skipTimingPhase(
          session,
          timingBlockId,
          'research',
          'Research',
          'Answered without external search',
        );
      }

      const [widgetOutputs, searchResults] = await Promise.all([
        widgetPromise,
        searchPromise,
      ]);

      session.emit('data', {
        type: 'researchComplete',
      });

      const finalContextWithWidgets = buildWriterContext(
        searchResults?.searchFindings,
        widgetOutputs,
      );

      const writerPrompt = getWriterPrompt(
        finalContextWithWidgets,
        input.config.systemInstructions,
        input.config.mode,
        {
          hasSearchResults: Boolean(searchResults?.searchFindings.length),
        },
      );

      startTimingPhase(session, timingBlockId, 'writing', 'Write');

      const answerStream = input.config.llm.streamText({
        messages: [
          {
            role: 'system',
            content: writerPrompt,
          },
          ...input.chatHistory,
          {
            role: 'user',
            content: input.followUp,
          },
        ],
      });

      let responseBlockId = '';

      for await (const chunk of answerStream) {
        if (!responseBlockId) {
          const block: TextBlock = {
            id: crypto.randomUUID(),
            type: 'text',
            data: chunk.contentChunk,
          };

          session.emitBlock(block);

          responseBlockId = block.id;
        } else {
          const block = session.getBlock(responseBlockId) as TextBlock | null;

          if (!block) {
            continue;
          }

          block.data += chunk.contentChunk;

          session.updateBlock(block.id, [
            {
              op: 'replace',
              path: '/data',
              value: block.data,
            },
          ]);
        }
      }

      finishTimingPhase(session, timingBlockId, 'writing');
      finishTimingPhase(session, timingBlockId, 'total');

      await persistence.flush('completed');
      session.emit('end', {});
    } catch (error: any) {
      await persistence.flush('error');
      session.emit('error', {
        data: error?.message || 'Search failed',
      });
      throw error;
    } finally {
      persistence.dispose();
    }
  }
}

export default SearchAgent;
