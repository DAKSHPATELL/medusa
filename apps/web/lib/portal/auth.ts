import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { PortalUser } from "@clearborder/shared";
import { getPortalUser } from "./queries";

export const SESSION_COOKIE = "tg_session";

export async function getSessionUser(): Promise<PortalUser | undefined> {
  const jar = await cookies();
  const username = jar.get(SESSION_COOKIE)?.value;
  if (!username) return undefined;
  return getPortalUser(username);
}

export async function requireUser(): Promise<PortalUser> {
  const user = await getSessionUser();
  if (!user) redirect("/portal/login");
  return user;
}
