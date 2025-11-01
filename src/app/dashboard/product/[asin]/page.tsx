'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

interface Product {
  _id: string;
  name: string;
  asin: string;
  url: string;
  priceHistory: { price: number; date: string }[];
  thresholdPrice: number;
  trackedBy: number[];
}

export default function ProductDetailPage() {
  const { asin } = useParams();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProduct() {
      try {
        const res = await fetch(`/api/dashboard/product/${asin}`);
        if (!res.ok) {
          throw new Error(`Error: ${res.status}`);
        }
        const data = await res.json();
        setProduct(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    if (asin) {
      fetchProduct();
    }
  }, [asin]);

  if (loading) return <div className="flex min-h-screen flex-col items-center justify-center p-24">Loading product details...</div>;
  if (error) return <div className="flex min-h-screen flex-col items-center justify-center p-24 text-red-500">Error: {error}</div>;
  if (!product) return <div className="flex min-h-screen flex-col items-center justify-center p-24">Product not found.</div>;

  const chartData = {
    labels: product.priceHistory.map(h => new Date(h.date).toLocaleDateString()),
    datasets: [
      {
        label: 'Price',
        data: product.priceHistory.map(h => h.price),
        borderColor: 'rgb(75, 192, 192)',
        tension: 0.1,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: `Price History for ${product.name}`,
      },
    },
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <h1 className="text-4xl font-bold mb-8">{product.name}</h1>
      <div className="w-full max-w-4xl">
        <p className="mb-2"><strong>ASIN:</strong> {product.asin}</p>
        <p className="mb-2"><strong>URL:</strong> <a href={product.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">Link</a></p>
        <p className="mb-2"><strong>Current Price:</strong> {product.priceHistory.slice(-1)[0]?.price || 'Price data not available'}</p>
        <p className="mb-2"><strong>Threshold Price:</strong> {product.thresholdPrice}</p>
        <p className="mb-4"><strong>Tracked By:</strong> {product.trackedBy.length} users</p>

        <div className="mt-8">
          <h2 className="text-2xl font-bold mb-4">Price History Chart</h2>
          <Line data={chartData} options={chartOptions} />
        </div>
      </div>
    </main>
  );
}
