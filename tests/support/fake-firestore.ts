/**
 * A tiny in-memory stand-in for the Firestore Admin SDK.
 *
 * It implements only the surface the repositories actually use — `collection`,
 * `doc`, `get`, `set`, `create`, and equality `where` / `orderBy` / `limit`
 * queries — so a service flow can be exercised end to end without the emulator,
 * which does not start in every environment.
 *
 * It is NOT a Firestore replacement: it does not enforce security rules,
 * composite indexes, transactions or inequality filters, so it proves that the
 * application code wires together correctly, not that the production rules are
 * correct. Those still need the emulator.
 */

type DocData = Record<string, unknown>;

interface Filter {
  readonly field: string;
  readonly op: '==';
  readonly value: unknown;
}

interface Order {
  readonly field: string;
  readonly direction: 'asc' | 'desc';
}

function snapshot(id: string, data: DocData | undefined) {
  return {
    id,
    exists: data !== undefined,
    data: () => data,
  };
}

class FakeQuery {
  constructor(
    private readonly store: Map<string, DocData>,
    private readonly filters: readonly Filter[] = [],
    private readonly order: Order | null = null,
    private readonly lim: number | null = null,
  ) {}

  where(field: string, op: '==', value: unknown): FakeQuery {
    return new FakeQuery(this.store, [...this.filters, { field, op, value }], this.order, this.lim);
  }

  orderBy(field: string, direction: 'asc' | 'desc' = 'asc'): FakeQuery {
    return new FakeQuery(this.store, this.filters, { field, direction }, this.lim);
  }

  limit(count: number): FakeQuery {
    return new FakeQuery(this.store, this.filters, this.order, count);
  }

  private rows(): Array<[string, DocData]> {
    let rows = [...this.store.entries()].filter(([, data]) =>
      this.filters.every((filter) => data[filter.field] === filter.value),
    );

    if (this.order) {
      const { field, direction } = this.order;
      rows = rows.sort(([, a], [, b]) => {
        const left = a[field] as string | number;
        const right = b[field] as string | number;
        if (left === right) return 0;
        const ascending = left < right ? -1 : 1;
        return direction === 'desc' ? -ascending : ascending;
      });
    }

    return this.lim === null ? rows : rows.slice(0, this.lim);
  }

  async get() {
    const rows = this.rows();
    return {
      empty: rows.length === 0,
      size: rows.length,
      docs: rows.map(([id, data]) => snapshot(id, data)),
    };
  }

  async count() {
    return { data: () => ({ count: this.rows().length }) };
  }
}

class FakeDocRef {
  constructor(
    private readonly store: Map<string, DocData>,
    readonly id: string,
  ) {}

  async get() {
    return snapshot(this.id, this.store.get(this.id));
  }

  async set(data: DocData, options?: { merge?: boolean }): Promise<void> {
    if (options?.merge && this.store.has(this.id)) {
      this.store.set(this.id, { ...this.store.get(this.id), ...data });
    } else {
      this.store.set(this.id, { ...data });
    }
  }

  async create(data: DocData): Promise<void> {
    if (this.store.has(this.id)) {
      throw new Error(`Document ${this.id} already exists`);
    }
    this.store.set(this.id, { ...data });
  }

  async delete(): Promise<void> {
    this.store.delete(this.id);
  }
}

class FakeCollection {
  private autoId = 0;

  constructor(private readonly store: Map<string, DocData>) {}

  doc(id?: string): FakeDocRef {
    return new FakeDocRef(this.store, id ?? `auto_${(this.autoId += 1)}`);
  }

  where(field: string, op: '==', value: unknown): FakeQuery {
    return new FakeQuery(this.store).where(field, op, value);
  }

  orderBy(field: string, direction: 'asc' | 'desc' = 'asc'): FakeQuery {
    return new FakeQuery(this.store).orderBy(field, direction);
  }

  limit(count: number): FakeQuery {
    return new FakeQuery(this.store).limit(count);
  }

  async count() {
    return new FakeQuery(this.store).count();
  }

  async get() {
    return new FakeQuery(this.store).get();
  }
}

export class FakeFirestore {
  private readonly collections = new Map<string, Map<string, DocData>>();

  collection(name: string): FakeCollection {
    let store = this.collections.get(name);
    if (!store) {
      store = new Map<string, DocData>();
      this.collections.set(name, store);
    }
    return new FakeCollection(store);
  }

  /** Test helper: read the raw document map for a collection. */
  dump(name: string): Map<string, DocData> {
    return this.collections.get(name) ?? new Map<string, DocData>();
  }

  /** Test helper: wipe everything between tests. */
  reset(): void {
    this.collections.clear();
  }

  // The real SDK exposes this; the repos call it once during bootstrap.
  settings(): void {}
}

/** Single shared instance so a mock factory and the test see the same store. */
export const fakeDb = new FakeFirestore();
