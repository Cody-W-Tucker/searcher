export const dynamic = 'force-dynamic';

export const POST = async () => {
  return Response.json(
    {
      message:
        'Model management is disabled. Configure models through your deployment.',
    },
    {
      status: 405,
    },
  );
};

export const DELETE = async () => {
  return Response.json(
    {
      message:
        'Model management is disabled. Configure models through your deployment.',
    },
    {
      status: 405,
    },
  );
};
