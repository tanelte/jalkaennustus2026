import { Trophy } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { LoginForm } from './LoginForm';

export const metadata = { title: 'Logi sisse — Jalkaennustus' };

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-bg-app">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-12">
        <Card>
          <CardContent className="space-y-6 p-8">
            <div className="flex flex-col items-center gap-2 text-center">
              <Trophy aria-hidden className="h-8 w-8 text-brand-green" />
              <p className="text-sm font-medium tracking-wide text-text-muted">
                Jalkaennustus
              </p>
            </div>
            <h1 className="text-center text-3xl font-semibold text-text-primary">
              Logi sisse
            </h1>
            <LoginForm />
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
