const appName = process.env.NEXT_PUBLIC_APP_NAME || "DigiLocker Vault";
const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const homeDescription = "Manage important documents in a secure personal vault with a modern digital workflow.";

export const metadata = {
  title: "DigiLocker",
  description: homeDescription,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: appName,
    description: homeDescription,
    type: "website",
    url: new URL("/", appUrl).toString(),
    siteName: appName,
  },
  twitter: {
    card: "summary_large_image",
    title: appName,
    description: homeDescription,
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function Home() {
  return <h1>DigiLocker</h1>;
}