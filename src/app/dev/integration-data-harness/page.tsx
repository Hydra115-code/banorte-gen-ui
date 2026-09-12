import { notFound } from "next/navigation";
import { DataRoundTripProbe } from "./DataRoundTripProbe";

export default function IntegrationDataHarnessPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <DataRoundTripProbe />;
}
