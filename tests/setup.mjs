import { vi } from 'vitest';

// The server-only marker throws outside a React Server Components build. Tests run server code
// directly, as the server does.
vi.mock('server-only', () => ({}));
