/// <reference types="jest" />

// orchestrator.test.ts
// Run with: npx jest orchestrator.test.ts
// Make sure jest + ts-jest are installed:
// npm install --save-dev jest ts-jest @types/jest

import { ParsedFunction } from './lib/types';

// ─── MOCK TYPES ───────────────────────────────────────────────────────────────

interface DBRecord {
  name: string;
  filePath: string;
  hash: string;
  startLine: number;
  endLine: number;
  body: string;
  renamedFrom?: string;
}

// ─── INLINE ORCHESTRATION LOGIC (mirrors extension.ts exactly) ───────────────
// We extract the pure logic here so we can test without VS Code runtime

function debounce<T extends (...args: any[]) => void>(
  fn: T,
  delay: number,
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, delay);
  };
}

async function runOrchestrationLogic(
  parsedFunctions: ParsedFunction[],
  getLatestFunctionHash: (
    name: string,
    filePath: string,
  ) => Promise<{ hash: string; startLine: number; name: string } | null>,
  findByHash: (
    hash: string,
    filePath: string,
  ) => Promise<{ name: string; startRow: number } | null>,
  commitFunctionToDB: (fn: DBRecord) => Promise<void>,
  filePath: string,
): Promise<void> {
  if (parsedFunctions.length === 0) return;

  for (const fn of parsedFunctions) {
    const existing = await getLatestFunctionHash(fn.name, filePath);

    if (!existing) {
      await commitFunctionToDB({
        name: fn.name,
        filePath,
        hash: fn.hash,
        startLine: fn.range.start.row,
        endLine: fn.range.end.row,
        body: fn.rawText,
      });
      continue;
    }

    if (existing.hash === fn.hash && existing.startLine === fn.range.start.row) {
      continue; // no change
    }

    await commitFunctionToDB({
      name: fn.name,
      filePath,
      hash: fn.hash,
      startLine: fn.range.start.row,
      endLine: fn.range.end.row,
      body: fn.rawText,
    });
  }

  // Rename sweep
  for (const fn of parsedFunctions) {
    const possibleRename = await findByHash(fn.hash, filePath);
    if (
      possibleRename &&
      possibleRename.name !== fn.name &&
      possibleRename.startRow === fn.range.start.row
    ) {
      await commitFunctionToDB({
        name: fn.name,
        filePath,
        hash: fn.hash,
        startLine: fn.range.start.row,
        endLine: fn.range.end.row,
        body: fn.rawText,
        renamedFrom: possibleRename.name,
      });
    }
  }
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function makeFn(overrides: Partial<ParsedFunction> = {}): ParsedFunction {
  return {
    name: 'testFn',
    hash: 'hash_abc123',
    rawText: 'function testFn() { return 1; }',
    calls: [],
    range: {
      start: { row: 0, column: 0 },
      end: { row: 2, column: 1 },
    },
    exportedAs: null,
    isExported: false,
    ...overrides,
  };
}

const FILE_PATH = '/mock/test.ts';
const noRename = async () => null;

// ─── TESTS ────────────────────────────────────────────────────────────────────

describe('Debouncer', () => {
  jest.useFakeTimers();

  test('fires once after delay even if called multiple times', () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 1500);

    debounced();
    debounced();
    debounced();
    debounced();
    debounced(); // 5 rapid calls

    expect(fn).not.toHaveBeenCalled(); // not yet

    jest.advanceTimersByTime(1500);

    expect(fn).toHaveBeenCalledTimes(1); // only once ✅
  });

  test('resets timer on each call', () => {
    const fn = jest.fn();
    const debounced = debounce(fn, 1500);

    debounced();
    jest.advanceTimersByTime(1000); // 1s in — not fired yet
    debounced(); // reset timer
    jest.advanceTimersByTime(1000); // 1s more — still not fired (needs 1.5s from last call)

    expect(fn).not.toHaveBeenCalled();

    jest.advanceTimersByTime(500); // now 1.5s from last call

    expect(fn).toHaveBeenCalledTimes(1); // ✅
  });
});

describe('Orchestrator — Empty File', () => {
  test('does nothing when no functions parsed', async () => {
    const commit = jest.fn();
    await runOrchestrationLogic([], async () => null, noRename, commit, FILE_PATH);
    expect(commit).not.toHaveBeenCalled(); // ✅
  });
});

describe('Orchestrator — New Function', () => {
  test('commits when function not in DB', async () => {
    const commit = jest.fn();
    const fn = makeFn();

    await runOrchestrationLogic(
      [fn],
      async () => null, // DB returns null = new function
      noRename,
      commit,
      FILE_PATH,
    );

    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'testFn',
        hash: 'hash_abc123',
      }),
    );
  });
});

describe('Orchestrator — No Change', () => {
  test('skips commit when hash and row are identical', async () => {
    const commit = jest.fn();
    const fn = makeFn();

    await runOrchestrationLogic(
      [fn],
      async () => ({ hash: 'hash_abc123', startLine: 0, name: 'testFn' }), // same hash + row
      noRename,
      commit,
      FILE_PATH,
    );

    expect(commit).not.toHaveBeenCalled(); // ✅ nothing changed
  });
});

describe('Orchestrator — Body Changed', () => {
  test('commits when hash is different', async () => {
    const commit = jest.fn();
    const fn = makeFn({ hash: 'hash_NEW' });

    await runOrchestrationLogic(
      [fn],
      async () => ({ hash: 'hash_OLD', startLine: 0, name: 'testFn' }), // different hash
      noRename,
      commit,
      FILE_PATH,
    );

    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledWith(
      expect.objectContaining({
        hash: 'hash_NEW',
      }),
    );
  });
});

describe('Orchestrator — Rename Detection', () => {
  test('detects rename when same hash + same row but different name', async () => {
    const commit = jest.fn();

    // fn is now called 'addNumbers' but DB has 'add' with same hash at same row
    const fn = makeFn({ name: 'addNumbers', hash: 'hash_abc123' });

    await runOrchestrationLogic(
      [fn],
      async () => ({ hash: 'hash_abc123', startLine: 0, name: 'addNumbers' }),
      // async (hash, _filePath) => {
      async (hash) => {
        if (hash === 'hash_abc123') {
          return { name: 'add', startRow: 0 }; // old name in DB
        }
        return null;
      },
      commit,
      FILE_PATH,
    );

    expect(commit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'addNumbers',
        renamedFrom: 'add', // ✅ rename tracked
      }),
    );
  });

  test('does NOT flag as rename when same hash but different row (duplicate body)', async () => {
    const commit = jest.fn();

    const fn = makeFn({
      name: 'funcB',
      hash: 'hash_abc123',
      range: { start: { row: 10, column: 0 }, end: { row: 12, column: 1 } },
    });

    await runOrchestrationLogic(
      [fn],
      async () => null,
      async () => ({ name: 'funcA', startRow: 0 }), // same hash but different row
      commit,
      FILE_PATH,
    );

    // Should commit as new, NOT as rename
    const call = commit.mock.calls[0][0];
    expect(call.renamedFrom).toBeUndefined(); // ✅ not a rename
  });
});

describe('Orchestrator — Multiple Functions', () => {
  test('only commits changed functions, skips unchanged', async () => {
    const commit = jest.fn();

    const unchanged = makeFn({ name: 'unchanged', hash: 'hash_same' });
    const changed = makeFn({
      name: 'changed',
      hash: 'hash_NEW',
      range: { start: { row: 5, column: 0 }, end: { row: 8, column: 1 } },
    });
    const brandNew = makeFn({
      name: 'brandNew',
      hash: 'hash_brandnew',
      range: { start: { row: 10, column: 0 }, end: { row: 12, column: 1 } },
    });

    await runOrchestrationLogic(
      [unchanged, changed, brandNew],
      async (name) => {
        if (name === 'unchanged') return { hash: 'hash_same', startLine: 0, name: 'unchanged' };
        if (name === 'changed') return { hash: 'hash_OLD', startLine: 5, name: 'changed' };
        return null; // brandNew not in DB
      },
      noRename,
      commit,
      FILE_PATH,
    );

    expect(commit).toHaveBeenCalledTimes(2); // changed + brandNew ✅
    const names = commit.mock.calls.map((c: any) => c[0].name);
    expect(names).toContain('changed');
    expect(names).toContain('brandNew');
    expect(names).not.toContain('unchanged'); // ✅ skipped
  });
});

describe('Orchestrator — DB Ready / Processing Lock', () => {
  test('isDBReady flag prevents processing before DB init', async () => {
    // Simulated via the guard in real extension.ts
    // Here we just verify the guard logic directly
    let isDBReady = false;
    let isProcessing = false;
    const commit = jest.fn();

    const guardedOrchestrate = async () => {
      if (!isDBReady || isProcessing) return; // guard
      isProcessing = true;
      try {
        await runOrchestrationLogic([makeFn()], async () => null, noRename, commit, FILE_PATH);
      } finally {
        isProcessing = false;
      }
    };

    await guardedOrchestrate(); // DB not ready
    expect(commit).not.toHaveBeenCalled(); // ✅ blocked

    isDBReady = true;
    await guardedOrchestrate(); // now ready
    expect(commit).toHaveBeenCalledTimes(1); // ✅ processed
  });

  test('processing lock prevents parallel execution', async () => {
    let isDBReady = true;
    let isProcessing = false;
    const commit = jest.fn();

    const guardedOrchestrate = async () => {
      if (!isDBReady || isProcessing) return;
      isProcessing = true;
      try {
        await runOrchestrationLogic([makeFn()], async () => null, noRename, commit, FILE_PATH);
      } finally {
        isProcessing = false;
      }
    };

    // Fire two at same time
    await Promise.all([guardedOrchestrate(), guardedOrchestrate()]);

    expect(commit).toHaveBeenCalledTimes(1); // ✅ second call was blocked
  });
});
