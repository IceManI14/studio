import type {Metadata} from 'next';
import './globals.css';
import dynamic from 'next/dynamic';

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
        <link href="https://fonts.googleapis.com/css2?family=Quicksand:wght@300;400;500;600&family=Nunito:wght@300;400;500;600&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased">
        <div className="relative z-10">
          {children}
        </div>
        <DynamicToaster />
      </body>
    </html>
  );
}
