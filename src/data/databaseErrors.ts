export function databaseRequestError(error: unknown, fallback: string): string {
  if (!error || typeof error !== "object") return fallback;
  const { code, message } = error as { code?: string; message?: string };
  const detail = `${code || ""} ${message || ""}`;
  if (
    /unauthenticated|requires a signed-in user|jwt expired|invalid jwt|PGRST301/i.test(
      detail,
    )
  ) {
    return "Your session has expired. Sign in again, then retry.";
  }
  if (
    /PERMISSION_DENIED|permission-denied|@auth rejected|unauthorized|42501/i.test(
      detail,
    )
  ) {
    return "Access was denied. Sign in again to refresh your session. If this continues, contact the administrator to check your account permissions.";
  }
  if (/PGRST202|could not find the function.*barkolink_execute/i.test(detail)) {
    return "This service is temporarily unavailable. Try again later or contact support.";
  }
  if (/\.env|Supabase is not configured|migration|relation .* does not exist|column .* does not exist|SQL|constraint|syntax|PGRST|fetch failed|failed to fetch|networkerror/i.test(detail)) return fallback;
  return message || fallback;
}
