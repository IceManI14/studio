import type {Metadata} from 'next';
import './globals.css';
// Remove the direct import of Toaster
// import { Toaster } from "@/components/ui/toaster";
import dynamic from 'next/dynamic';

// Dynamically import Toaster. Since Toaster itself is a Client Component (uses 'use client'),
// Next.js will automatically handle it as a client boundary without needing ssr: false here.
const DynamicToaster = dynamic(() => 
  import('@/components/ui/toaster').then((mod) => mod.Toaster)
);

export const metadata: Metadata = {
  title: 'Optimum Trailblazer',
  description: 'Track your company visits and contacts.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased">
        {children}
        <DynamicToaster /> {/* Use the dynamically imported Toaster */}
      </body>
    </html>
  );
}
