import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from 'vitest';

// vi.mock is hoisted above all imports — so the mock factory cannot close over
// outer scope. Use `vi.hoisted` to expose the spy in a way that is also hoisted.
const { sendTransacEmail } = vi.hoisted(() => ({
  sendTransacEmail: vi.fn(),
}));

vi.mock('@getbrevo/brevo', () => {
  class FakeBrevoClient {
    public transactionalEmails = { sendTransacEmail };
    constructor(_options: { apiKey: string }) {}
  }
  return { BrevoClient: FakeBrevoClient };
});

import { sendRecoveryEmail } from './send';

describe('sendRecoveryEmail', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    sendTransacEmail.mockReset();
    process.env.BREVO_API_KEY = 'xkeysib-test-key';
    process.env.BREVO_SENDER_EMAIL = 'no-reply@example.com';
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    delete process.env.BREVO_API_KEY;
    delete process.env.BREVO_SENDER_EMAIL;
  });

  it('returns { ok: true } on a successful send', async () => {
    sendTransacEmail.mockResolvedValueOnce({ messageId: 'abc' });

    const result = await sendRecoveryEmail({
      to: 'user@example.com',
      subject: 'Lähtesta oma PIN',
      body: 'Klõpsa lingil...',
    });

    expect(result).toEqual({ ok: true });
    expect(sendTransacEmail).toHaveBeenCalledTimes(1);
    const arg = (sendTransacEmail as Mock).mock.calls[0]![0];
    expect(arg.subject).toBe('Lähtesta oma PIN');
    expect(arg.textContent).toBe('Klõpsa lingil...');
    expect(arg.to).toEqual([{ email: 'user@example.com' }]);
    expect(arg.sender.email).toBe('no-reply@example.com');
  });

  it('returns { ok: false, reason: "failed" } when the SDK throws', async () => {
    sendTransacEmail.mockRejectedValueOnce(new Error('boom: 401 unauthorized'));

    const result = await sendRecoveryEmail({
      to: 'user@example.com',
      subject: 's',
      body: 'b',
    });

    expect(result).toEqual({ ok: false, reason: 'failed' });
  });

  it('returns { ok: false, reason: "timeout" } when the SDK hangs past 3 s', async () => {
    vi.useFakeTimers();
    // Promise that never resolves.
    sendTransacEmail.mockReturnValueOnce(new Promise(() => undefined));

    const promise = sendRecoveryEmail({
      to: 'user@example.com',
      subject: 's',
      body: 'b',
    });

    // Advance just past the 3s timeout budget.
    await vi.advanceTimersByTimeAsync(3_001);
    const result = await promise;
    expect(result).toEqual({ ok: false, reason: 'timeout' });
  });

  it('returns { ok: false, reason: "failed" } when BREVO_API_KEY is missing — without invoking the SDK', async () => {
    delete process.env.BREVO_API_KEY;

    const result = await sendRecoveryEmail({
      to: 'user@example.com',
      subject: 's',
      body: 'b',
    });

    expect(result).toEqual({ ok: false, reason: 'failed' });
    expect(sendTransacEmail).not.toHaveBeenCalled();
  });
});
