const {
  classifyError, nextProvider, executeWithFailover,
} = require('../../main/brain/spine/providerFailover');

describe('classifyError', () => {
  test('ECONNRESET → transient', () => {
    expect(classifyError({ code: 'ECONNRESET' })).toBe('transient');
  });
  test('ETIMEDOUT → transient', () => {
    expect(classifyError({ code: 'ETIMEDOUT' })).toBe('transient');
  });
  test('429 → transient', () => {
    expect(classifyError({ status: 429 })).toBe('transient');
  });
  test('503 → transient', () => {
    expect(classifyError({ status: 503 })).toBe('transient');
  });
  test('500 → failover', () => {
    expect(classifyError({ status: 500 })).toBe('failover');
  });
  test('502 → failover', () => {
    expect(classifyError({ status: 502 })).toBe('failover');
  });
  test('401 → fatal (no failover on auth)', () => {
    expect(classifyError({ status: 401 })).toBe('fatal');
  });
  test('404 → fatal', () => {
    expect(classifyError({ status: 404 })).toBe('fatal');
  });
  test('axios response.status path works', () => {
    expect(classifyError({ response: { status: 503 } })).toBe('transient');
  });
  test('network message without code', () => {
    expect(classifyError({ message: 'socket hang up' })).toBe('transient');
  });
  test('rate limit message', () => {
    expect(classifyError({ message: 'rate limit exceeded' })).toBe('transient');
  });
  test('null → fatal', () => {
    expect(classifyError(null)).toBe('fatal');
  });
});

describe('nextProvider', () => {
  test('walks the chain', () => {
    expect(nextProvider('DeepSeek', ['DeepSeek', 'Kimi', 'ChatGPT'])).toBe('Kimi');
    expect(nextProvider('Kimi',     ['DeepSeek', 'Kimi', 'ChatGPT'])).toBe('ChatGPT');
  });
  test('past end returns null', () => {
    expect(nextProvider('ChatGPT', ['DeepSeek', 'Kimi', 'ChatGPT'])).toBeNull();
  });
  test('not in chain → first', () => {
    expect(nextProvider('Unknown', ['DeepSeek', 'Kimi'])).toBe('DeepSeek');
  });
});

describe('executeWithFailover', () => {
  test('happy path: first provider succeeds, 1 attempt', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    const out = await executeWithFailover({ chain: ['DeepSeek', 'Kimi'], fn });
    expect(out.result).toBe('ok');
    expect(out.provider).toBe('DeepSeek');
    expect(out.attempts).toBe(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('5xx on first → walks to second, success', async () => {
    const observed = [];
    const fn = jest.fn()
      .mockRejectedValueOnce(Object.assign(new Error('boom'), { status: 500 }))
      .mockResolvedValueOnce('ok');
    const out = await executeWithFailover({
      chain: ['DeepSeek', 'Kimi'], fn,
      onAttemptFailed: (e) => observed.push(e),
    });
    expect(out.result).toBe('ok');
    expect(out.provider).toBe('Kimi');
    expect(out.attempts).toBe(2);
    expect(observed).toHaveLength(1);
    expect(observed[0].provider).toBe('DeepSeek');
    expect(observed[0].reason).toBe('failover');
  });

  test('429 transient retries same provider, then succeeds', async () => {
    const observed = [];
    const fn = jest.fn()
      .mockRejectedValueOnce(Object.assign(new Error('rate'), { status: 429 }))
      .mockResolvedValueOnce('ok');
    const out = await executeWithFailover({
      chain: ['DeepSeek', 'Kimi'], fn,
      onAttemptFailed: (e) => observed.push(e),
    });
    expect(out.result).toBe('ok');
    expect(out.provider).toBe('DeepSeek');
    expect(out.attempts).toBe(2);
    expect(observed[0].reason).toBe('transient');
  });

  test('401 on first → stops, throws (no failover on auth)', async () => {
    const observed = [];
    const fn = jest.fn().mockRejectedValue(Object.assign(new Error('auth'), { status: 401 }));
    await expect(executeWithFailover({
      chain: ['DeepSeek', 'Kimi'], fn,
      onAttemptFailed: (e) => observed.push(e),
    })).rejects.toThrow(/exhausted chain/);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(observed[0].reason).toBe('fatal');
  });

  test('all providers fail → throws with cause + tried', async () => {
    const fn = jest.fn().mockRejectedValue(Object.assign(new Error('down'), { status: 500 }));
    try {
      await executeWithFailover({ chain: ['DeepSeek', 'Kimi'], fn });
      fail('should have thrown');
    } catch (e) {
      expect(e.message).toContain('exhausted chain');
      expect(e.tried).toEqual(['DeepSeek', 'Kimi']);
      expect(e.cause).toBeDefined();
    }
  });

  test('empty chain throws synchronously-equivalent', async () => {
    await expect(executeWithFailover({ chain: [], fn: jest.fn() }))
      .rejects.toThrow(/empty chain/);
  });
});
