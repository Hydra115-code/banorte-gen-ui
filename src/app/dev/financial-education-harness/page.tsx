import { notFound } from "next/navigation";
import { FinancialEducationGallery } from "./FinancialEducationGallery";

export default function FinancialEducationHarnessPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <FinancialEducationGallery />;
}
