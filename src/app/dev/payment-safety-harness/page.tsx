import { notFound } from "next/navigation";
import { PaymentSafetyGallery } from "./PaymentSafetyGallery";

export default function PaymentSafetyHarnessPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <PaymentSafetyGallery />;
}
