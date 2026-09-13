import { notFound } from "next/navigation";
import { UIInteractionHarness } from "./UIInteractionHarness";

export default function UIInteractionHarnessPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <UIInteractionHarness />;
}
