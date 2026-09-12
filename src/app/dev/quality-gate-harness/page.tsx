import { notFound } from "next/navigation";
import { QualityGateGallery } from "./QualityGateGallery";

export default function QualityGateHarnessPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <QualityGateGallery />;
}
