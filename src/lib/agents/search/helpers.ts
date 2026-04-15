import { Chunk } from '@/lib/types';
import { ClassifierOutput, WidgetOutput } from './types';

export const createSpeedModeClassification = (
  query: string,
): ClassifierOutput => ({
  classification: {
    skipSearch: false,
    personalSearch: false,
    academicSearch: false,
    discussionSearch: false,
    showStockWidget: false,
    showCalculationWidget: false,
  },
  standaloneFollowUp: query,
});

export const buildWriterContext = (
  searchFindings: Chunk[] = [],
  widgetOutputs: WidgetOutput[] = [],
) => {
  const finalContext =
    searchFindings.length > 0
      ? searchFindings
          .map(
            (finding, index) =>
              `<result index=${index + 1} title=${finding.metadata.title}>${finding.content}</result>`,
          )
          .join('\n')
      : '<Query to be answered without search results; no relevant results were found>';

  const widgetContext = widgetOutputs
    .map((output) => `<result>${output.llmContext}</result>`)
    .join('\n-------------\n');

  return `<search_results note="These are the search results and assistant can cite these">\n${finalContext}\n</search_results>\n<widgets_result noteForAssistant="Its output is already showed to the user, assistant can use this information to answer the query but do not CITE this as a souce">\n${widgetContext}\n</widgets_result>`;
};
