import { notFound } from "next/navigation";
import { AgentTextProbe } from "./AgentTextProbe";

export default function AgentTextHarnessPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <AgentTextProbe />;
}
