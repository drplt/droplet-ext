// Runs async work over a list with bounded concurrency. Stops scheduling new work once `signal` aborts.

type PoolOptions = {
  concurrency: number;
  signal?: AbortSignal;
};

const mapPool = async <Item, Result>(
  items: readonly Item[],
  worker: (item: Item, index: number) => Promise<Result>,
  { concurrency, signal }: PoolOptions,
): Promise<Result[]> => {
  if (concurrency < 1) throw new RangeError('concurrency must be at least 1');

  const results = new Array<Result>(items.length);
  let next = 0;

  const run = async () => {
    while (next < items.length) {
      signal?.throwIfAborted();
      const index = next++;
      // `index < items.length` is guaranteed by the loop condition and single-threaded increment.
      results[index] = await worker(items[index] as Item, index);
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, run));
  signal?.throwIfAborted();
  return results;
};

const chunk = <Item>(items: readonly Item[], size: number): Item[][] => {
  const chunks: Item[][] = [];
  for (let start = 0; start < items.length; start += size) {
    chunks.push(items.slice(start, start + size));
  }
  return chunks;
};

export { chunk, mapPool };
