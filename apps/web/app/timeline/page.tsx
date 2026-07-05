import type { Metadata } from "next";
import { TimelineExperience } from "@/components/demo/TimelineExperience";

export const metadata: Metadata = {
  title: "ClearBorder — Live observed timeline",
  description: "Real-time observed facts from the ClearBorder agent: case status, portal actions, and declaration API.",
};

export default function TimelinePage() {
  return <TimelineExperience />;
}
