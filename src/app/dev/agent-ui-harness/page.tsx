import { notFound } from "next/navigation";
import { AgentUIProbe } from "./AgentUIProbe";

export default function AgentUIHarnessPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <AgentUIProbe />;
}
