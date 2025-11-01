'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function CreateProductPage() {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [thresholdPrice, setThresholdPrice] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);

    try {
      const res = await fetch('/api/admin/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, url, thresholdPrice }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || `Error: ${res.status}`);
      }

      setMessage('Product created successfully!');
      setName('');
      setUrl('');
      setThresholdPrice(0);
      router.push('/dashboard/products'); // Redirect to products list
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">Create New Product</h1>
      <div className="bg-white shadow-md rounded-lg p-6">
        <form onSubmit={handleSubmit}>
          {message && <p className="bg-green-100 text-green-700 p-3 rounded-md mb-4">{message}</p>}
          {error && <p className="bg-red-100 text-red-700 p-3 rounded-md mb-4">{error}</p>}

          <div className="mb-4">
            <label htmlFor="name" className="block text-gray-700 text-sm font-semibold mb-2">Product Name:</label>
            <input
              type="text"
              id="name"
              className="shadow-sm appearance-none border border-gray-300 rounded-md w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="mb-4">
            <label htmlFor="url" className="block text-gray-700 text-sm font-semibold mb-2">Product URL:</label>
            <input
              type="url"
              id="url"
              className="shadow-sm appearance-none border border-gray-300 rounded-md w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
            />
          </div>

          <div className="mb-6">
            <label htmlFor="thresholdPrice" className="block text-gray-700 text-sm font-semibold mb-2">Threshold Price:</label>
            <input
              type="number"
              id="thresholdPrice"
              className="shadow-sm appearance-none border border-gray-300 rounded-md w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={thresholdPrice}
              onChange={(e) => setThresholdPrice(parseFloat(e.target.value))}
              required
              min="0"
              step="0.01"
            />
          </div>

          <div className="flex items-center justify-between">
            <button
              type="submit"
              disabled={loading}
              className={`px-6 py-3 rounded-md text-white font-semibold transition-colors duration-200 ${loading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
            >
              {loading ? 'Creating...' : 'Create Product'}
            </button>
            <button
              type="button"
              onClick={() => router.push('/dashboard/products')}
              className="px-6 py-3 rounded-md text-gray-700 border border-gray-300 hover:bg-gray-100 transition-colors duration-200"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
