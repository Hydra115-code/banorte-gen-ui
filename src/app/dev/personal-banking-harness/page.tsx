import { notFound } from "next/navigation";
import { PersonalBankingGallery } from "./PersonalBankingGallery";

export default function PersonalBankingHarnessPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <PersonalBankingGallery />;
}
