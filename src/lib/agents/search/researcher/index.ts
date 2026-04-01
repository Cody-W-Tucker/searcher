import { ActionOutput, ResearcherInput, ResearcherOutput } from '../types';
import { ActionRegistry } from './actions';
import { getResearcherPrompt } from '@/lib/prompts/search/researcher';
import SessionManager from '@/lib/session';
import {
  Chunk,
  Message,
  ReasoningResearchBlock,
  ResearchBlockSubStep,
  SearchResultsResearchBlock,
} from '@/lib/types';
import formatChatHistoryAsString from '@/lib/utils/formatHistory';
import { ToolCall } from '@/lib/models/types';
import UploadStore from '@/lib/uploads/store';
import { searchExa } from '@/lib/exa';

const dedupeSearchResults = (searchResults: Chunk[]) => {
  const seenUrls = new Map<string, number>();

  return searchResults
    .map((result, index) => {
      if (result.metadata.url && !seenUrls.has(result.metadata.url)) {
        seenUrls.set(result.metadata.url, index);
        return result;
      }

      if (result.metadata.url && seenUrls.has(result.metadata.url)) {
        const existingIndex = seenUrls.get(result.metadata.url)!;
        const existingResult = searchResults[existingIndex];

        existingResult.content += `\n\n${result.content}`;

        return undefined;
      }

      return result;
    })
    .filter((result) => result !== undefined);
};

class Researcher {
  private appendResearchSubStep(
    session: SessionManager,
    researchBlockId: string,
    subStep: ResearchBlockSubStep,
  ) {
    const researchBlock = session.getBlock(researchBlockId);

    if (!researchBlock || researchBlock.type !== 'research') {
      return;
    }

    researchBlock.data.subSteps.push(subStep);

    session.updateBlock(researchBlockId, [
      {
        op: 'replace',
        path: '/data/subSteps',
        value: researchBlock.data.subSteps,
      },
    ]);
  }

  private async researchDirect(
    session: SessionManager,
    input: ResearcherInput,
  ): Promise<ResearcherOutput> {
    const researchBlockId = crypto.randomUUID();

    session.emitBlock({
      id: researchBlockId,
      type: 'research',
      data: {
        subSteps: [],
      },
    });

    const query = input.classification.standaloneFollowUp || input.followUp;
    const searchFindings: Chunk[] = [];

    const runSearch = async (
      searchType: string,
      searchFn: () => Promise<Chunk[]>,
    ) => {
      this.appendResearchSubStep(session, researchBlockId, {
        id: crypto.randomUUID(),
        type: 'searching',
        searching: [`${searchType}: ${query}`],
      });

      const results = await searchFn();

      if (results.length > 0) {
        this.appendResearchSubStep(session, researchBlockId, {
          id: crypto.randomUUID(),
          type: 'search_results',
          reading: results,
        });
      }

      searchFindings.push(...results);
    };

    const tasks: Promise<void>[] = [];

    if (input.config.fileIds.length > 0) {
      tasks.push(
        (async () => {
          this.appendResearchSubStep(session, researchBlockId, {
            id: crypto.randomUUID(),
            type: 'upload_searching',
            queries: [query],
          });

          const uploadStore = new UploadStore({
            embeddingModel: input.config.embedding,
            fileIds: input.config.fileIds,
          });

          const results = dedupeSearchResults(
            await uploadStore.query([query], 10),
          );

          if (results.length > 0) {
            this.appendResearchSubStep(session, researchBlockId, {
              id: crypto.randomUUID(),
              type: 'upload_search_results',
              results,
            });
          }

          searchFindings.push(...results);
        })(),
      );
    }

    if (input.config.sources.includes('web')) {
      tasks.push(
        runSearch('Web', async () => {
          const results = await searchExa(query);

          return results.results.map((result) => ({
            content: result.content || result.title,
            metadata: {
              title: result.title,
              url: result.url,
            },
          }));
        }),
      );
    }

    if (input.config.sources.includes('academic')) {
      tasks.push(
        runSearch('Academic', async () => {
          const results = await searchExa(query, {
            category: 'research paper',
          });

          return results.results.map((result) => ({
            content: result.content || result.title,
            metadata: {
              title: result.title,
              url: result.url,
            },
          }));
        }),
      );
    }

    if (input.config.sources.includes('discussions')) {
      tasks.push(
        runSearch('Discussions', async () => {
          const results = await searchExa(query, {
            includeDomains: ['reddit.com'],
          });

          return results.results.map((result) => ({
            content: result.content || result.title,
            metadata: {
              title: result.title,
              url: result.url,
            },
          }));
        }),
      );
    }

    await Promise.all(tasks);

    const filteredSearchResults = dedupeSearchResults(searchFindings);

    session.emitBlock({
      id: crypto.randomUUID(),
      type: 'source',
      data: filteredSearchResults,
    });

    return {
      findings: [
        {
          type: 'search_results',
          results: filteredSearchResults,
        },
      ],
      searchFindings: filteredSearchResults,
    };
  }

  async research(
    session: SessionManager,
    input: ResearcherInput,
  ): Promise<ResearcherOutput> {
    if (input.config.mode === 'speed') {
      return this.researchDirect(session, input);
    }

    let actionOutput: ActionOutput[] = [];
    const maxIteration = input.config.mode === 'balanced' ? 6 : 25;

    const availableTools = ActionRegistry.getAvailableActionTools({
      classification: input.classification,
      fileIds: input.config.fileIds,
      mode: input.config.mode,
      sources: input.config.sources,
    });

    const availableActionsDescription =
      ActionRegistry.getAvailableActionsDescriptions({
        classification: input.classification,
        fileIds: input.config.fileIds,
        mode: input.config.mode,
        sources: input.config.sources,
      });

    const researchBlockId = crypto.randomUUID();

    session.emitBlock({
      id: researchBlockId,
      type: 'research',
      data: {
        subSteps: [],
      },
    });

    const agentMessageHistory: Message[] = [
      {
        role: 'user',
        content: `
          <conversation>
          ${formatChatHistoryAsString(input.chatHistory.slice(-10))}
           User: ${input.followUp} (Standalone question: ${input.classification.standaloneFollowUp})
           </conversation>
        `,
      },
    ];

    for (let i = 0; i < maxIteration; i++) {
      const researcherPrompt = getResearcherPrompt(
        availableActionsDescription,
        input.config.mode,
        i,
        maxIteration,
        input.config.fileIds,
      );

      const actionStream = input.config.llm.streamText({
        messages: [
          {
            role: 'system',
            content: researcherPrompt,
          },
          ...agentMessageHistory,
        ],
        tools: availableTools,
      });

      const block = session.getBlock(researchBlockId);

      let reasoningEmitted = false;
      let reasoningId = crypto.randomUUID();

      let finalToolCalls: ToolCall[] = [];

      for await (const partialRes of actionStream) {
        if (partialRes.toolCallChunk.length > 0) {
          partialRes.toolCallChunk.forEach((tc) => {
            if (
              tc.name === '__reasoning_preamble' &&
              tc.arguments['plan'] &&
              !reasoningEmitted &&
              block &&
              block.type === 'research'
            ) {
              reasoningEmitted = true;

              block.data.subSteps.push({
                id: reasoningId,
                type: 'reasoning',
                reasoning: tc.arguments['plan'],
              });

              session.updateBlock(researchBlockId, [
                {
                  op: 'replace',
                  path: '/data/subSteps',
                  value: block.data.subSteps,
                },
              ]);
            } else if (
              tc.name === '__reasoning_preamble' &&
              tc.arguments['plan'] &&
              reasoningEmitted &&
              block &&
              block.type === 'research'
            ) {
              const subStepIndex = block.data.subSteps.findIndex(
                (step: any) => step.id === reasoningId,
              );

              if (subStepIndex !== -1) {
                const subStep = block.data.subSteps[
                  subStepIndex
                ] as ReasoningResearchBlock;
                subStep.reasoning = tc.arguments['plan'];
                session.updateBlock(researchBlockId, [
                  {
                    op: 'replace',
                    path: '/data/subSteps',
                    value: block.data.subSteps,
                  },
                ]);
              }
            }

            const existingIndex = finalToolCalls.findIndex(
              (ftc) => ftc.id === tc.id,
            );

            if (existingIndex !== -1) {
              finalToolCalls[existingIndex].arguments = tc.arguments;
            } else {
              finalToolCalls.push(tc);
            }
          });
        }
      }

      if (finalToolCalls.length === 0) {
        break;
      }

      if (finalToolCalls[finalToolCalls.length - 1].name === 'done') {
        break;
      }

      agentMessageHistory.push({
        role: 'assistant',
        content: '',
        tool_calls: finalToolCalls,
      });

      const actionResults = await ActionRegistry.executeAll(finalToolCalls, {
        llm: input.config.llm,
        embedding: input.config.embedding,
        session: session,
        researchBlockId: researchBlockId,
        fileIds: input.config.fileIds,
      });

      actionOutput.push(...actionResults);

      actionResults.forEach((action, i) => {
        agentMessageHistory.push({
          role: 'tool',
          id: finalToolCalls[i].id,
          name: finalToolCalls[i].name,
          content: JSON.stringify(action),
        });
      });
    }

    const searchResults = actionOutput
      .filter((a) => a.type === 'search_results')
      .flatMap((a) => a.results);

    const filteredSearchResults = dedupeSearchResults(searchResults);

    session.emitBlock({
      id: crypto.randomUUID(),
      type: 'source',
      data: filteredSearchResults,
    });

    return {
      findings: actionOutput,
      searchFindings: filteredSearchResults,
    };
  }
}

export default Researcher;
