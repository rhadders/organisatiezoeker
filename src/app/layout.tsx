import type { Metadata } from "next";
import { Jost, Lora } from "next/font/google";

import { Toaster } from "@/components/ui/sonner";

import "./globals.css";

/*
 * Jost en Lora zijn de substituties uit het Jona design system (het logo
 * bevat alleen outlines). Ze worden bij de build binnengehaald en vanaf de
 * eigen origin geserveerd.
 */
const jost = Jost({
  variable: "--font-jost",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
});

const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: {
    default: "Organisatiezoeker",
    template: "%s · Organisatiezoeker",
  },
  description: "Zoek, selecteer en exporteer organisaties met contactpersonen.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="nl"
      className={`${jost.variable} ${lora.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-mist-50">{children}
        <Toaster />
      </body>
    </html>
  );
}
