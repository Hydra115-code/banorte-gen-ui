import { notFound } from "next/navigation";
import { PerformanceProbe } from "./PerformanceProbe";

export default function PerformanceHarnessPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <PerformanceProbe />;
}
