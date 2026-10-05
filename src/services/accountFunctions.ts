import type { SupabaseClient } from "@supabase/supabase-js";

export function accountFunction<Input, Output>(
  client: SupabaseClient,
  action: string,
) {
  return async (input: Input): Promise<{ data: Output }> => {
    const { data, error } = await client.functions.invoke("manage-account", {
      body: { action, input },
    });
    if (error) {
      const response = (error as { context?: Response }).context;
      const body = response ? await response.json().catch(() => null) : null;
      throw new Error(body?.error || error.message);
    }
    return { data: data as Output };
  };
}
