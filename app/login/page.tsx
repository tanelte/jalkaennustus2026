import Link from 'next/link';
import { LoginForm } from './LoginForm';

export const metadata = { title: 'Logi sisse — Jalkaennustus' };

export default function LoginPage() {
  return (
    <main className="mx-auto max-w-md p-8">
      <h1 className="text-2xl font-semibold">Logi sisse</h1>
      <p className="mt-2 text-sm text-gray-600">
        Sisesta oma grupi kasutajanimi ja parool.
      </p>
      <LoginForm />
      <p className="mt-6 text-sm text-gray-600">
        Pole veel gruppi?{' '}
        <Link href="/groups/new" className="underline">
          Loo uus grupp
        </Link>
      </p>
    </main>
  );
}
