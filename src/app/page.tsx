'use client';

import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold mb-8">Welcome to Trackzoon!</h1>
      <p className="text-lg mb-8">Your personal product price tracker.</p>
      <Link href="/dashboard" className="px-6 py-3 bg-blue-600 text-white rounded-lg text-xl hover:bg-blue-700 transition-colors">
        Go to Dashboard
      </Link>
    </main>
  );
}