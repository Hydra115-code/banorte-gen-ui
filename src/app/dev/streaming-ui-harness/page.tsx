import { StreamingUIHarness } from "./StreamingUIHarness";

export default function StreamingUIHarnessPage() {
  if (process.env.NODE_ENV === "production") return null;
  return <StreamingUIHarness />;
}
