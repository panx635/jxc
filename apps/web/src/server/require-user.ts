import { redirect } from "next/navigation";
import { getCurrentUser } from "./current-user";
import type { SessionUser } from "./session";

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
