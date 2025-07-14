
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BrainCircuit, Users, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl shadow-2xl bg-card/80 backdrop-blur-md border-primary/30">
        <CardHeader className="text-center">
          <div className="flex justify-center items-center gap-3 mb-4">
            <BrainCircuit className="h-12 w-12 text-primary" />
            <CardTitle className="text-4xl font-headline text-primary">
              Optimum Trailblazer
            </CardTitle>
          </div>
          <CardDescription className="text-lg text-foreground/80">
            Your AI-Powered Sales Assistant for the Field
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-base text-foreground/90 space-y-4">
            <p>
              Optimum Trailblazer is a cutting-edge application designed to empower sales professionals by logging client visits, tracking interactions, and providing actionable, AI-driven insights. From identifying hot leads in your territory to summarizing visit notes, Trailblazer is your partner in optimizing your sales strategy.
            </p>
            <p>
              Built with a modern tech stack including Next.js, React, and Genkit for AI, this tool is engineered for performance and efficiency, ensuring you have the information you need, right when you need it.
            </p>
          </div>
          
          <div className="text-center pt-4">
            <Link href="/" passHref>
              <Button>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Home
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
