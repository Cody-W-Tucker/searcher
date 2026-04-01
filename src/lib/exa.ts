import { getExaApiKey } from './config/serverRegistry';

type ExaSearchType = 'fast' | 'auto' | 'deep' | 'deep-reasoning';
type ExaSearchCategory = 'news' | 'research paper' | 'company' | 'people';

type ExaContentOptions = {
  text?: {
    maxCharacters?: number;
  };
  highlights?: {
    maxCharacters?: number;
    query?: string;
  };
  extras?: {
    imageLinks?: number;
  };
};

interface ExaSearchOptions {
  type?: ExaSearchType;
  category?: ExaSearchCategory;
  numResults?: number;
  includeDomains?: string[];
  excludeDomains?: string[];
  maxAgeHours?: number;
  contents?: ExaContentOptions;
}

export interface ExaSearchResult {
  title: string;
  url: string;
  content?: string;
  author?: string;
  publishedDate?: string;
  image?: string;
  favicon?: string;
  imageLinks?: string[];
  highlights?: string[];
  score?: number;
}

type ExaApiSearchResult = {
  title?: string;
  url?: string;
  content?: string;
  text?: string;
  highlights?: string[];
  author?: string | null;
  publishedDate?: string;
  published_date?: string;
  image?: string;
  favicon?: string;
  imageLinks?: string[];
  image_links?: string[];
  score?: number;
};

const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_CONTENTS: ExaContentOptions = {
  highlights: {
    maxCharacters: 4000,
  },
};

const normalizeContents = (contents: ExaContentOptions) => {
  return {
    ...(contents.text
      ? {
          text: {
            ...contents.text,
            ...(contents.text.maxCharacters !== undefined
              ? {
                  max_characters: contents.text.maxCharacters,
                }
              : {}),
          },
        }
      : {}),
    ...(contents.highlights
      ? {
          highlights: {
            ...contents.highlights,
            ...(contents.highlights.maxCharacters !== undefined
              ? {
                  max_characters: contents.highlights.maxCharacters,
                }
              : {}),
          },
        }
      : {}),
    ...(contents.extras
      ? {
          extras: {
            ...contents.extras,
            ...(contents.extras.imageLinks !== undefined
              ? {
                  image_links: contents.extras.imageLinks,
                }
              : {}),
          },
        }
      : {}),
  };
};

const normalizeResult = (result: ExaApiSearchResult): ExaSearchResult => {
  const highlights = Array.isArray(result.highlights)
    ? result.highlights.filter(Boolean)
    : undefined;

  return {
    title: result.title ?? result.url ?? 'Untitled',
    url: result.url ?? '',
    content: result.content ?? result.text ?? highlights?.join('\n\n'),
    author: result.author ?? undefined,
    publishedDate: result.publishedDate ?? result.published_date,
    image: result.image,
    favicon: result.favicon,
    imageLinks: result.imageLinks ?? result.image_links ?? [],
    highlights,
    score: result.score,
  };
};

export const searchExa = async (query: string, opts: ExaSearchOptions = {}) => {
  const exaApiKey = getExaApiKey();
  const numResults = opts.numResults ?? 10;
  const contents = normalizeContents(opts.contents ?? DEFAULT_CONTENTS);

  if (!exaApiKey) {
    throw new Error('Exa API key is not configured');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const res = await fetch('https://api.exa.ai/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': exaApiKey,
      },
      body: JSON.stringify({
        query,
        q: query,
        type: opts.type ?? 'fast',
        category: opts.category,
        numResults,
        num_results: numResults,
        includeDomains: opts.includeDomains,
        include_domains: opts.includeDomains,
        excludeDomains: opts.excludeDomains,
        exclude_domains: opts.excludeDomains,
        maxAgeHours: opts.maxAgeHours,
        max_age_hours: opts.maxAgeHours,
        contents,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(
        `Exa error: ${res.status} ${res.statusText}${errorText ? ` - ${errorText}` : ''}`,
      );
    }

    const data = (await res.json()) as { results?: ExaApiSearchResult[] };

    return {
      results: (data.results ?? []).map(normalizeResult),
    };
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new Error('Exa search timed out');
    }

    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
};
