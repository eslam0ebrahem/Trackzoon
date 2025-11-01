'use client';

import Link from 'next/link';
import { signOut } from 'next-auth/react';

export default function AdminSidebar() {
  return (
    <aside className="w-64 bg-gray-800 text-white p-4 flex flex-col justify-between">
      <div>
        <h2 className="text-2xl font-bold mb-8 text-center">Trackzoon Admin</h2>
        <nav>
          <ul>
            <li className="mb-3">
              <Link href="/dashboard" className="block py-2 px-4 rounded hover:bg-gray-700 transition-colors duration-200">Dashboard</Link>
            </li>
            <li className="mb-3">
              <Link href="/dashboard/users" className="block py-2 px-4 rounded hover:bg-gray-700 transition-colors duration-200">Manage Users</Link>
            </li>
            <li className="mb-3">
              <Link href="/dashboard/products" className="block py-2 px-4 rounded hover:bg-gray-700 transition-colors duration-200">Manage Products</Link>
            </li>
            <li className="mb-3">
              <Link href="/dashboard/logs" className="block py-2 px-4 rounded hover:bg-gray-700 transition-colors duration-200">View Logs</Link>
            </li>
            <li className="mb-3">
              <Link href="/dashboard/trigger-price-update" className="block py-2 px-4 rounded hover:bg-gray-700 transition-colors duration-200">Trigger Price Update</Link>
            </li>
          </ul>
        </nav>
      </div>
      <div className="mt-8">
        <button onClick={() => signOut()} className="w-full py-2 px-4 rounded bg-red-600 hover:bg-red-700 transition-colors duration-200 text-white font-semibold">
          Sign Out
        </button>
      </div>
    </aside>
  );
}