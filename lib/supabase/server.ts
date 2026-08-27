import "server-only"

import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

import type { Database } from "@/lib/supabase/generated/database.types"
import { getPublicSupabaseEnvironment } from "@/lib/supabase/env"

export async function createClient() {
  const cookieStore = await cookies()
  const { url, publishableKey } = getPublicSupabaseEnvironment()

  return createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        } catch {
          // Server Components cannot write cookies. Route Handlers and Server Actions can.
        }
      },
    },
  })
}
