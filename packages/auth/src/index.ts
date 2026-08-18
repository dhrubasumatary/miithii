import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

export type MiithiiUser = User;

export type PublicSupabaseEnv = {
  NEXT_PUBLIC_SUPABASE_URL?: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
};

export function getPublicSupabaseEnv(env: PublicSupabaseEnv = getRuntimeEnv()) {
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase public environment variables");
  }

  return { supabaseUrl, supabaseAnonKey };
}

export function createBrowserAuthClient(env?: PublicSupabaseEnv): SupabaseClient {
  const { supabaseUrl, supabaseAnonKey } = getPublicSupabaseEnv(env);

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: "pkce",
      persistSession: true,
      storageKey: "miithii.auth"
    }
  });
}

export async function getCurrentUser(client: SupabaseClient): Promise<MiithiiUser | null> {
  const { data, error } = await client.auth.getUser();
  if (error) {
    return null;
  }

  return data.user;
}

function getRuntimeEnv(): PublicSupabaseEnv {
  if (typeof process === "undefined") {
    return {};
  }

  return process.env;
}

