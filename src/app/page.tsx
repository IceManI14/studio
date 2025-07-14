
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="text-2xl">Welcome to Your App!</CardTitle>
          <CardDescription>
            This is your new, rebuilt starting page. We can now add features from here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p>Let's get building. What would you like to do first?</p>
        </CardContent>
      </Card>
    </main>
  );
}
