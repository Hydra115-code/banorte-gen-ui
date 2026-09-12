import { notFound } from "next/navigation";
import { FixtureGallery } from "./FixtureGallery";

export default function ContractHarnessPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <FixtureGallery />;
}
