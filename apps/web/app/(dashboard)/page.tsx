import type { Metadata } from "next";
import { MissionControl } from "@/components/dashboard/MissionControl";

export const metadata: Metadata = {
  title: "ClearBorder — Mission Control",
  description:
    "Live operations view of the ClearBorder agent: calls, portal actions, memory and approvals.",
};

export default function DashboardPage() {
  return <MissionControl />;
}
