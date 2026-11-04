import { AsyncLocalStorage } from 'node:async_hooks';
import { vi } from 'vitest';

// The server-only marker throws outside a React Server Components build. Tests run server code
// directly, as the server does.
vi.mock('server-only', () => ({}));

// Next.js installs this global when its server starts. unstable_cache and revalidateTag need it.
globalThis.AsyncLocalStorage ??= AsyncLocalStorage;
