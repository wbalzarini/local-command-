import type { Metadata, Viewport } from "next";
import { CommandShell } from "@/components/command-center/CommandShell";
import { SettingsProvider } from "@/lib/settings/store";
import "./globals.css";

/**
 * The document, the settings store and the Command Center's frame.
 *
 * Every route in this app sits inside the same nav rail, so the shell belongs
 * here rather than in a nested layout.
 */

export const metadata: Metadata = {
  title: "Command Center",
  description:
    "Personal intelligence dashboard: weather, pressure trends, radar, severe weather alerts, commute and traffic intelligence, road conditions and publicly announced public-safety information, assembled into one daily briefing.",
  applicationName: "Command Center",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Command Center",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#0b0e14",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <SettingsProvider>
          <CommandShell>{children}</CommandShell>
        </SettingsProvider>
      </body>
    </html>
  );
}
