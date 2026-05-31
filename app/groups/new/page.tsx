import Link from 'next/link';
import { CreateGroupForm } from './CreateGroupForm';

export const metadata = { title: 'Loo uus grupp — Jalkaennustus' };

export default function NewGroupPage() {
  return (
    <main className="mx-auto max-w-md p-8">
      <h1 className="text-2xl font-semibold">Loo uus grupp</h1>
      <p className="mt-2 text-sm text-gray-600">
        Vali grupile kasutajanimi ja parool. Pärast loomist saad lisada grupi liikmed.
      </p>
      <CreateGroupForm />
      <p className="mt-6 text-sm text-gray-600">
        On juba grupp?{' '}
        <Link href="/login" className="underline">
          Logi sisse
        </Link>
      </p>
    </main>
  );
}
