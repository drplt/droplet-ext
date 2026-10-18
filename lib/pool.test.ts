import { chunk, mapPool } from './pool';

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>(r => {
    resolve = r;
  });
  return { promise, resolve };
};

describe('mapPool', () => {
  it('preserves order and never exceeds the concurrency limit', async () => {
    let active = 0;
    let peak = 0;
    const results = await mapPool(
      [5, 1, 4, 2, 3],
      async value => {
        active++;
        peak = Math.max(peak, active);
        await new Promise(resolve => setTimeout(resolve, value));
        active--;
        return value * 10;
      },
      { concurrency: 2 },
    );
    expect(results).toEqual([50, 10, 40, 20, 30]);
    expect(peak).toBe(2);
  });

  it('stops scheduling work after abort', async () => {
    const controller = new AbortController();
    const gate = deferred();
    const started: number[] = [];
    const run = mapPool(
      [1, 2, 3, 4],
      async value => {
        started.push(value);
        if (value === 1) {
          controller.abort();
          await gate.promise;
        }
        return value;
      },
      { concurrency: 1, signal: controller.signal },
    );
    gate.resolve();
    await expect(run).rejects.toThrow();
    expect(started).toEqual([1]);
  });

  it('handles empty input', async () => {
    await expect(mapPool([], () => Promise.resolve(1), { concurrency: 3 })).resolves.toEqual([]);
  });

  it('rejects invalid concurrency', async () => {
    await expect(mapPool([1], () => Promise.resolve(1), { concurrency: 0 })).rejects.toThrow(RangeError);
  });
});

describe('chunk', () => {
  it('splits into fixed-size groups', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 50)).toEqual([]);
  });
});
