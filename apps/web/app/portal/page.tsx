import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/portal/auth";

export default async function PortalIndex() {
  const user = await getSessionUser();
  redirect(user ? "/portal/cases" : "/portal/login");
}
