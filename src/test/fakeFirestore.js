// In-memory stand-in for the slice of firebase-admin Firestore that the API
// handlers use, for handler tests. It supports docs and subcollections by
// path, auto ids, where('==' | 'in'), transactions and batches (writes apply
// when the callback or commit finishes; a throw discards them), set with
// merge, dotted update paths, and the serverTimestamp / increment sentinels.

export function createFakeFirestore() {
  let docs = new Map();
  let autoId = 0;
  let clock = 1000000;

  const Timestamp = {
    fromMillis: (ms) => ({ toMillis: () => ms }),
  };
  const FieldValue = {
    serverTimestamp: () => ({ __op: 'serverTimestamp' }),
    increment: (n) => ({ __op: 'increment', n }),
  };

  function resolve(value, prev) {
    if (value && value.__op === 'serverTimestamp') return Timestamp.fromMillis(clock);
    if (value && value.__op === 'increment') return (typeof prev === 'number' ? prev : 0) + value.n;
    return value;
  }

  // Applies fields onto a copy of target, resolving sentinels. With dotted,
  // 'a.b' writes the nested field b of map a (Firestore update semantics).
  function applyFields(target, fields, dotted) {
    const out = { ...target };
    for (const [key, value] of Object.entries(fields)) {
      const parts = dotted ? key.split('.') : [key];
      let node = out;
      for (let i = 0; i < parts.length - 1; i += 1) {
        node[parts[i]] = { ...(node[parts[i]] || {}) };
        node = node[parts[i]];
      }
      const last = parts[parts.length - 1];
      node[last] = resolve(value, node[last]);
    }
    return out;
  }

  function write(path, kind, data, opts) {
    const prev = docs.get(path);
    if (kind === 'update') {
      if (prev === undefined) throw new Error(`fake firestore: no document to update: ${path}`);
      docs.set(path, applyFields(prev, data, true));
    } else if (opts && opts.merge) {
      docs.set(path, applyFields(prev || {}, data, false));
    } else {
      docs.set(path, applyFields({}, data, false));
    }
  }

  function snapshotOf(path) {
    const data = docs.get(path);
    return {
      id: path.split('/').pop(),
      ref: docRef(path),
      exists: data !== undefined,
      data: () => (data === undefined ? undefined : { ...data }),
    };
  }

  function docRef(path) {
    return {
      id: path.split('/').pop(),
      path,
      get: async () => snapshotOf(path),
      set: async (data, opts) => write(path, 'set', data, opts),
      update: async (data) => write(path, 'update', data),
      delete: async () => {
        docs.delete(path);
      },
      collection: (name) => collectionRef(`${path}/${name}`),
    };
  }

  function childPaths(path) {
    const prefix = `${path}/`;
    return [...docs.keys()]
      .filter((k) => k.startsWith(prefix) && !k.slice(prefix.length).includes('/'))
      .sort();
  }

  function matches(data, { field, op, value }) {
    if (op === '==') return data[field] === value;
    if (op === 'in') return value.includes(data[field]);
    throw new Error(`fake firestore: unsupported where op ${op}`);
  }

  function collectionRef(path, filters = []) {
    return {
      path,
      doc: (id) => docRef(`${path}/${id || `auto${(autoId += 1)}`}`),
      add: async (data) => {
        const ref = docRef(`${path}/auto${(autoId += 1)}`);
        await ref.set(data);
        return ref;
      },
      where: (field, op, value) => collectionRef(path, [...filters, { field, op, value }]),
      orderBy: () => collectionRef(path, filters),
      limit: () => collectionRef(path, filters),
      get: async () => {
        const out = childPaths(path)
          .filter((p) => filters.every((f) => matches(docs.get(p), f)))
          .map(snapshotOf);
        return { docs: out, empty: out.length === 0, size: out.length };
      },
    };
  }

  function queuedWriter() {
    const queue = [];
    const api = {
      set: (ref, data, opts) => {
        queue.push(() => write(ref.path, 'set', data, opts));
        return api;
      },
      update: (ref, data) => {
        queue.push(() => write(ref.path, 'update', data));
        return api;
      },
      delete: (ref) => {
        queue.push(() => docs.delete(ref.path));
        return api;
      },
      flush: () => queue.splice(0).forEach((apply) => apply()),
    };
    return api;
  }

  const db = {
    collection: (name) => collectionRef(name),
    batch: () => {
      const w = queuedWriter();
      return { set: w.set, update: w.update, delete: w.delete, commit: async () => w.flush() };
    },
    runTransaction: async (fn) => {
      const w = queuedWriter();
      const tx = { get: (target) => target.get(), set: w.set, update: w.update, delete: w.delete };
      const result = await fn(tx);
      w.flush();
      return result;
    },
  };

  return {
    db,
    FieldValue,
    Timestamp,
    reset() {
      docs = new Map();
      autoId = 0;
      clock = 1000000;
    },
    seed(path, data) {
      docs.set(path, { ...data });
    },
    read(path) {
      const d = docs.get(path);
      return d === undefined ? undefined : { ...d };
    },
    paths(collectionPath) {
      return childPaths(collectionPath);
    },
    snapshot() {
      return Object.fromEntries([...docs].map(([k, v]) => [k, { ...v }]));
    },
    setClock(ms) {
      clock = ms;
    },
  };
}
