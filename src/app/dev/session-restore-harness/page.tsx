import { notFound } from "next/navigation";
import { SessionRestoreSeeder } from "./SessionRestoreSeeder";

export default function SessionRestoreHarnessPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <SessionRestoreSeeder />;
}
