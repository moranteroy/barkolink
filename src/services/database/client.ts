import type { SupabaseClient } from "@supabase/supabase-js";

export type DatabaseClient = SupabaseClient;
export type QueryOptions = {
  fetchPolicy?: "SERVER_ONLY" | "CACHE_ONLY" | "PREFER_CACHE";
  page?: number;
  pageSize?: number;
  status?: string;
  search?: string;
};

// PostgreSQL derives identity from Supabase Auth and enforces roles itself.
export async function executeDatabase<T>(
  client: DatabaseClient,
  operation: string,
  variables: object,
): Promise<{ data: T }> {
  const { data, error } = await client.rpc("barkolink_execute", {
    operation,
    args: variables,
  });
  if (error) throw error;
  return { data: data as T };
}
