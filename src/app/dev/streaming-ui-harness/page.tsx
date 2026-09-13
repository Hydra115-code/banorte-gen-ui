import { notFound } from "next/navigation";
import { StreamingUIHarness } from "./StreamingUIHarness";

export default function StreamingUIHarnessPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <StreamingUIHarness />;
}
