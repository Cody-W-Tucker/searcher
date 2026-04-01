import React from 'react';
import {
  ConfigModelProvider,
  ModelProviderUISection,
} from '@/lib/config/types';
import ModelSelect from './ModelSelect';

const Models = ({
  fields: _fields,
  values,
}: {
  fields: ModelProviderUISection[];
  values: ConfigModelProvider[];
}) => {
  const chatProviders = values.filter((p) =>
    p.chatModels.some((m) => m.key !== 'error'),
  );
  const embeddingProviders = values.filter((p) =>
    p.embeddingModels.some((m) => m.key !== 'error'),
  );
  const hasConfiguredModels =
    chatProviders.length > 0 || embeddingProviders.length > 0;

  return (
    <div className="flex-1 space-y-6 overflow-y-auto py-6">
      <div className="flex flex-col px-6 gap-y-4">
        <h3 className="text-xs lg:text-xs text-black/70 dark:text-white/70">
          Select models
        </h3>
        {chatProviders.length > 0 && (
          <ModelSelect providers={chatProviders} type="chat" />
        )}
        {embeddingProviders.length > 0 && (
          <ModelSelect providers={embeddingProviders} type="embedding" />
        )}
      </div>
      <div className="border-t border-light-200 dark:border-dark-200" />
      <div className="px-6">
        <section className="rounded-xl border border-light-200 bg-light-primary/80 p-4 lg:p-6 transition-colors dark:border-dark-200 dark:bg-dark-primary/80">
          <div className="space-y-2">
            <h4 className="text-sm lg:text-sm text-black dark:text-white">
              Deployment-managed providers
            </h4>
            <p className="text-[11px] lg:text-xs text-black/50 dark:text-white/50">
              Providers and server-side API keys are configured outside the UI.
              Update your NixOS module or environment variables to change them.
            </p>
            {!hasConfiguredModels && (
              <p className="text-[11px] lg:text-xs text-black/50 dark:text-white/50">
                No models are currently available. Configure `OPENAI_API_KEY`
                and model lists in your deployment to enable chat.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default Models;
