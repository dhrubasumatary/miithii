export function isAdminUserId(userId: string | null | undefined) {
  if (!userId) return false;

  return (process.env.MIITHII_ADMIN_USER_IDS || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
    .includes(userId);
}
