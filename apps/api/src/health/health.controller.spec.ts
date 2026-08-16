import { HealthController } from './health.controller';

describe('HealthController', () => {
  const prisma = { $queryRaw: jest.fn() };
  const controller = new HealthController(prisma as never);

  it('returns the API health status', () => {
    const response = controller.check();

    expect(response.status).toBe('ok');
    expect(response.service).toBe('donflow-api');
    expect(new Date(response.timestamp).toISOString()).toBe(response.timestamp);
  });

  it('reports readiness when the database responds', async () => {
    prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

    await expect(controller.ready()).resolves.toEqual(
      expect.objectContaining({
        status: 'ok',
        database: 'up',
      }),
    );
  });

  it('reports unavailability when the database does not respond', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('connection refused'));

    await expect(controller.ready()).rejects.toThrow(
      'A base de dados está indisponível.',
    );
  });
});
