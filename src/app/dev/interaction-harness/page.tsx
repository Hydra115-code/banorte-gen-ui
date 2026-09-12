import { notFound } from "next/navigation";
import { InteractionProbe } from "./InteractionProbe";

export default function InteractionHarnessPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <InteractionProbe />;
}
