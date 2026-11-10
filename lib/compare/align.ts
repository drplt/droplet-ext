// Aligns two sequences by their longest common subsequence. Everything between two matches is a "gap": items only
// in the old sequence (removed) and items only in the new one (added).

type AlignStep = { a: number; b: number; type: 'match' } | { added: number[]; removed: number[]; type: 'gap' };

// The table is (n+1)×(m+1) 32-bit cells; beyond this the differing middle is reported as one big gap instead.
const MAX_CELLS = 4_000_000;

const longestCommonPairs = (a: readonly string[], b: readonly string[]): [number, number][] => {
  const pairs: [number, number][] = [];

  let start = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) {
    pairs.push([start, start]);
    start++;
  }
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }

  const rows = endA - start;
  const columns = endB - start;
  if (rows > 0 && columns > 0 && rows * columns <= MAX_CELLS) {
    const width = columns + 1;
    const table = new Uint32Array((rows + 1) * width);
    const cell = (row: number, column: number) => table[row * width + column] ?? 0;
    for (let row = rows - 1; row >= 0; row--) {
      for (let column = columns - 1; column >= 0; column--) {
        table[row * width + column] =
          a[start + row] === b[start + column]
            ? cell(row + 1, column + 1) + 1
            : Math.max(cell(row + 1, column), cell(row, column + 1));
      }
    }
    let row = 0;
    let column = 0;
    while (row < rows && column < columns) {
      if (a[start + row] === b[start + column]) {
        pairs.push([start + row, start + column]);
        row++;
        column++;
      } else if (cell(row + 1, column) >= cell(row, column + 1)) {
        row++;
      } else {
        column++;
      }
    }
  }

  for (let offset = 0; endA + offset < a.length; offset++) pairs.push([endA + offset, endB + offset]);
  return pairs;
};

const range = (from: number, to: number) => Array.from({ length: to - from }, (_, index) => from + index);

const alignSequences = (a: readonly string[], b: readonly string[]): AlignStep[] => {
  const steps: AlignStep[] = [];
  let nextA = 0;
  let nextB = 0;
  const gapUntil = (untilA: number, untilB: number) => {
    if (untilA > nextA || untilB > nextB) {
      steps.push({ type: 'gap', removed: range(nextA, untilA), added: range(nextB, untilB) });
    }
  };
  for (const [indexA, indexB] of longestCommonPairs(a, b)) {
    gapUntil(indexA, indexB);
    steps.push({ type: 'match', a: indexA, b: indexB });
    nextA = indexA + 1;
    nextB = indexB + 1;
  }
  gapUntil(a.length, b.length);
  return steps;
};

export { alignSequences, type AlignStep };
