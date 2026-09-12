import type { Metadata } from "next";
import { connection } from "next/server";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Banorte | Espacio financiero",
  description: "Espacio de interfaces financieras generadas en tiempo real.",
};

interface RootLayoutProps {
  children: ReactNode;
}

export default async function RootLayout({ children }: RootLayoutProps) {
  await connection();

  return (
    <html data-theme="light" lang="es">
      <body>{children}</body>
    </html>
  );
}
