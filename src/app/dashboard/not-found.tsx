import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-24">
      <h2 className="text-2xl font-bold">404 - Page Not Found</h2>
      <p className="mt-4">Could not find the requested resource.</p>
      <Link href="/dashboard" className="mt-6 text-blue-500 hover:underline">
        Return to Dashboard
      </Link>
    </div>
  );
}
