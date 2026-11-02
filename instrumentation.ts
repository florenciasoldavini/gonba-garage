/**
 * Runs once per server instance, before it serves requests. Logs the feature groups that are only
 * half configured (variable names only, never values). It does not stop the server: each feature
 * still checks its own configuration when it runs, and fully unset optional features stay quiet.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { misconfiguredFeatures } = await import('./lib/env');
  for (const problem of misconfiguredFeatures()) {
    console.warn(JSON.stringify({ event: 'environment_misconfigured', ...problem }));
  }
}
