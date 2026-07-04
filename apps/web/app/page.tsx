import type { Metadata } from "next";
import { DemoExperience } from "@/components/demo/DemoExperience";

export const metadata: Metadata = {
  title: "ClearBorder — Live Demo",
  description:
    "Watch ClearBorder resolve a customs hold: multilingual calls, portal automation, and persistent memory across days.",
};

export default function HomePage() {
  return <DemoExperience />;
}
