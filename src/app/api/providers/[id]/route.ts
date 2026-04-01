export const dynamic = 'force-dynamic';

export const DELETE = async () => {
  return Response.json(
    {
      message:
        'Provider deletion is disabled. Configure providers through your deployment.',
    },
    {
      status: 405,
    },
  );
};

export const PATCH = async () => {
  return Response.json(
    {
      message:
        'Provider updates are disabled. Configure providers through your deployment.',
    },
    {
      status: 405,
    },
  );
};
