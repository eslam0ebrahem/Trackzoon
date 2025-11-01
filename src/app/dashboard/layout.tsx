import React from 'react';
import AdminSidebar from './components/AdminSidebar';

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <AdminSidebar />
      <div className="flex-1 flex flex-col">
        <header className="bg-white shadow-sm p-4 border-b border-gray-200">
          <div className="container mx-auto">
            <h1 className="text-xl font-semibold text-gray-800">Admin Dashboard</h1>
          </div>
        </header>
        <main className="flex-1 p-6 bg-gray-50">
          <div className="container mx-auto bg-white p-6 rounded-lg shadow-md">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
