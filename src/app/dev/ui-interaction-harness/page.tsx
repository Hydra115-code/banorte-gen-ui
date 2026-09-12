import { UIInteractionHarness } from "./UIInteractionHarness";

export default function UIInteractionHarnessPage() {
  if (process.env.NODE_ENV === "production") return null;
  return <UIInteractionHarness />;
}
