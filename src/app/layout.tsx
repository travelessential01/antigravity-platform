import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { IdleTimeout } from "@/components/auth/IdleTimeout";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "StayAssist — Patient Complaint Management",
    template: "%s | StayAssist",
  },
  description: "StayAssist: Secure, compliance-first hospital patient complaint management platform. NABH/JCI/DPDP compliant.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <IdleTimeout />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
