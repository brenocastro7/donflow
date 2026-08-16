import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { ResendNotificationProvider } from './resend-notification.provider';

describe('ResendNotificationProvider', () => {
  const provider = new ResendNotificationProvider();

  afterEach(() => {
    jest.restoreAllMocks();
    delete process.env.EMAIL_API_KEY;
    delete process.env.EMAIL_FROM_ADDRESS;
    delete process.env.EMAIL_FROM_NAME;
    delete process.env.APP_PUBLIC_URL;
  });

  it('sends a verification email with a frontend action link', async () => {
    process.env.EMAIL_API_KEY = 're_test';
    process.env.EMAIL_FROM_ADDRESS = 'notifications@example.com';
    process.env.EMAIL_FROM_NAME = 'DonFlow';
    process.env.APP_PUBLIC_URL = 'https://app.example.com';
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ id: 'email-id' }), { status: 200 }),
      );

    await expect(
      provider.send({
        kind: 'EMAIL_VERIFICATION',
        recipient: 'customer@example.com',
        token: 'secret-token',
        expiresAt: new Date('2026-08-01T10:00:00.000Z'),
      }),
    ).resolves.toEqual({ providerMessageId: 'email-id' });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer re_test',
          'Idempotency-Key': expect.stringMatching(/^[a-f0-9]{64}$/),
        }),
        body: expect.stringContaining(
          'https://app.example.com/customer/confirm-email?token=secret-token',
        ),
      }),
    );
    const request = fetchMock.mock.calls[0][1] as RequestInit;
    expect(typeof request.body).toBe('string');
    const body = JSON.parse(request.body as string) as {
      html: string;
      text: string;
    };
    expect(body.html).toContain('background:#080807');
    expect(body.html).toContain('background:#c99a4a');
    expect(body.html).toContain('Confirmar e-mail');
    expect(body.html).not.toContain('<img');
    expect(body.text).toContain(
      'https://app.example.com/customer/confirm-email',
    );
  });

  it('sends an appointment confirmation from outbox data', async () => {
    process.env.EMAIL_API_KEY = 're_test';
    process.env.EMAIL_FROM_ADDRESS = 'notifications@example.com';
    process.env.EMAIL_FROM_NAME = 'DonFlow';
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ id: 'appointment-email-id' }), {
        status: 200,
      }),
    );

    await expect(
      provider.send({
        kind: 'APPOINTMENT_CONFIRMATION',
        recipient: 'customer@example.com',
        appointmentId: 'appointment-id',
        payload: {
          version: 1,
          serviceName: 'Haircut',
          startsAt: '2026-08-01T09:00:00.000Z',
        },
      }),
    ).resolves.toEqual({ providerMessageId: 'appointment-email-id' });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('Marcação confirmada'),
      }),
    );
  });

  it('escapes appointment data inside the branded HTML template', async () => {
    process.env.EMAIL_API_KEY = 're_test';
    process.env.EMAIL_FROM_ADDRESS = 'notifications@example.com';
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ id: 'safe-email-id' }), { status: 200 }),
      );

    await provider.send({
      kind: 'APPOINTMENT_CONFIRMATION',
      recipient: 'customer@example.com',
      appointmentId: 'appointment-id',
      payload: {
        version: 1,
        serviceName: '<script>alert(1)</script>',
        barberName: 'Ruben & Equipa',
        startsAt: '2026-08-01T09:00:00.000Z',
        audience: 'CUSTOMER',
      },
    });

    const request = fetchMock.mock.calls[0][1] as RequestInit;
    expect(typeof request.body).toBe('string');
    const body = JSON.parse(request.body as string) as { html: string };
    expect(body.html).not.toContain('<script>');
    expect(body.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(body.html).toContain('Ruben &amp; Equipa');
  });
});
