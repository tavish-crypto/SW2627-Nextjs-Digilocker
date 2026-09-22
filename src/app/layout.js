import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const appName = process.env.NEXT_PUBLIC_APP_NAME || "DigiLocker Vault";
const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const appDescription = "Secure digital document vault for storing, organizing, and managing important records.";

export const metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: appName,
    template: `%s | ${appName}`,
  },
  description: appDescription,
  applicationName: appName,
  openGraph: {
    siteName: appName,
    title: appName,
    description: appDescription,
    type: "website",
    url: new URL("/", appUrl).toString(),
  },
  twitter: {
    card: "summary_large_image",
    title: appName,
    description: appDescription,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}