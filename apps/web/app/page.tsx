import type { Metadata } from "next";
import { DemoExperience } from "@/components/demo/DemoExperience";

export const metadata: Metadata = {
  title: "ClearBorder — Agent Demo (internal)",
  description:
    "Internal operator view of ClearBorder resolving a customs hold: voice calls, portal automation, and persistent memory. Not a customer product.",
};

export default function HomePage() {
  return <DemoExperience />;
}
