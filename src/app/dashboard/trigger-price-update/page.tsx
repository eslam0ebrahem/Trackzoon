'use client';

import { useState } from 'react';

export default function TriggerPriceUpdatePage() {
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleTriggerUpdate = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/trigger-price-update', {
        method: 'POST',
      });
      if (!res.ok) {
        throw new Error(`Error: ${res.status}`);
      }
      const data = await res.json();
      setMessage(data.message || 'Price update triggered successfully!');
    } catch (err: any) {
      setMessage(`Error triggering price update: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">Manually Trigger Price Update</h1>
      <div className="bg-white shadow-md rounded-lg p-6">
        <p className="mb-4 text-gray-700">Click the button below to manually trigger a price update for all tracked products.</p>
        <button
          onClick={handleTriggerUpdate}
          disabled={loading}
          className={`px-6 py-3 rounded-md text-white font-semibold transition-colors duration-200 ${loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
        >
          {loading ? 'Triggering...' : 'Trigger Price Update Now'}
        </button>
        {message && (
          <p className={`mt-4 p-3 rounded-md ${message.startsWith('Error') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
            {message}
          </p>
        )}
      </div>
    </div>
  );
}