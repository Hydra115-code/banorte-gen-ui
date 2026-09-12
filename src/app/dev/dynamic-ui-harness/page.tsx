import { notFound } from "next/navigation";
import { DynamicUIProbe } from "./DynamicUIProbe";

export default function DynamicUIHarnessPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <DynamicUIProbe />;
}
