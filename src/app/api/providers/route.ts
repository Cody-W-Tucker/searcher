import ModelRegistry from '@/lib/models/registry';

export const dynamic = 'force-dynamic';

export const GET = async () => {
  try {
    const registry = new ModelRegistry();

    const activeProviders = await registry.getActiveProviders();

    const filteredProviders = activeProviders.filter((p) => {
      return !p.chatModels.some((m) => m.key === 'error');
    });

    return Response.json(
      {
        providers: filteredProviders,
      },
      {
        status: 200,
      },
    );
  } catch (err) {
    console.error('An error occurred while fetching providers', err);
    return Response.json(
      {
        message: 'An error has occurred.',
      },
      {
        status: 500,
      },
    );
  }
};

export const POST = async () => {
  return Response.json(
    {
      message:
        'Provider creation is disabled. Configure providers through your deployment.',
    },
    {
      status: 405,
    },
  );
};
