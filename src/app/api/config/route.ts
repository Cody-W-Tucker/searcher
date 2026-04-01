import configManager from '@/lib/config';
import ModelRegistry from '@/lib/models/registry';
import { NextResponse } from 'next/server';
import { ConfigModelProvider } from '@/lib/config/types';

export const dynamic = 'force-dynamic';

export const GET = async () => {
  try {
    const values = configManager.getCurrentConfig();
    const fields = configManager.getUIConfigSections();

    const modelRegistry = new ModelRegistry();
    const modelProviders = await modelRegistry.getActiveProviders();

    values.modelProviders = values.modelProviders.map(
      (mp: ConfigModelProvider) => {
        const activeProvider = modelProviders.find((p) => p.id === mp.id);

        return {
          ...mp,
          chatModels: activeProvider?.chatModels ?? mp.chatModels,
          embeddingModels:
            activeProvider?.embeddingModels ?? mp.embeddingModels,
        };
      },
    );

    return NextResponse.json({
      values,
      fields,
    });
  } catch (err) {
    console.error('Error in getting config: ', err);
    return Response.json(
      { message: 'An error has occurred.' },
      { status: 500 },
    );
  }
};

export const POST = async () => {
  return Response.json(
    {
      message:
        'Server-side config updates are disabled. Configure Vane through your deployment.',
    },
    {
      status: 405,
    },
  );
};
