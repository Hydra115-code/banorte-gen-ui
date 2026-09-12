import { notFound } from "next/navigation";
import { PatchContinuityProbe } from "./PatchContinuityProbe";

export default function PatchContinuityHarnessPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <PatchContinuityProbe />;
}
