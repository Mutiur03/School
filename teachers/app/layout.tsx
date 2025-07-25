import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/authContext";
import { AppProvider } from "@/context/appContext";
import { Toaster } from "@/components/toaster";
import ClientLayoutShell from "@/components/LayoutShell";
import { MyThemeProvider } from "@/components/MyThemeProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Teachers Dashboard",
  description: "A dashboard for teachers to manage their classes and students.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <MyThemeProvider>
          <AppProvider>
            <AuthProvider>
              <ClientLayoutShell>
                {children}
              </ClientLayoutShell>
              <Toaster />
            </AuthProvider>
          </AppProvider>
        </MyThemeProvider>
      </body>
    </html>
  );
}
