import { createBrowserClient } from "@supabase/ssr"

import type { Database } from "@/lib/supabase/generated/database.types"
import { getPublicSupabaseEnvironment } from "@/lib/supabase/env"

export function createClient() {
  const { url, publishableKey } = getPublicSupabaseEnvironment()

  return createBrowserClient<Database>(url, publishableKey)
}
