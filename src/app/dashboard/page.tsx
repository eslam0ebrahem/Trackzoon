'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';

interface Product {
  _id: string;
  name: string;
  asin: string;
  url: string;
  priceHistory: { price: number; date: string }[];
  thresholdPrice: number;
  trackedBy: number[];
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editedProduct, setEditedProduct] = useState<Partial<Product> | null>(null);

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/admin/products');
      if (!res.ok) {
        throw new Error(`Error: ${res.status}`);
      }
      const data = await res.json();
      setProducts(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === 'authenticated') {
      fetchProducts();
    }
  }, [status]);

  const handleDeleteProduct = async (asin: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;

    try {
      const res = await fetch('/api/admin/products', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ asin }),
      });

      if (!res.ok) {
        throw new Error(`Error: ${res.status}`);
      }

      setProducts(products.filter(p => p.asin !== asin));
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleEditClick = (product: Product) => {
    setEditingProductId(product._id);
    setEditedProduct({ ...product });
  };

  const handleCancelEdit = () => {
    setEditingProductId(null);
    setEditedProduct(null);
  };

  const handleSaveEdit = async () => {
    if (!editedProduct || !editingProductId) return;

    try {
      const res = await fetch('/api/admin/products', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editedProduct),
      });

      if (!res.ok) {
        throw new Error(`Error: ${res.status}`);
      }

      setEditingProductId(null);
      setEditedProduct(null);
      fetchProducts(); // Re-fetch products to get the latest data
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setEditedProduct(prev => ({
      ...prev,
      [name]: name === 'thresholdPrice' ? parseFloat(value) : value,
    }));
  };

  if (status === 'loading' || loading) return <div className="p-6 text-center">Loading dashboard...</div>;
  if (status === 'unauthenticated') return <div className="p-6 text-center text-red-500">Access Denied. Please sign in as an administrator.</div>;
  if (error) return <div className="p-6 text-center text-red-500">Error: {error}</div>;

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">Admin Dashboard</h1>
      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <h2 className="text-xl font-semibold p-4 border-b border-gray-200">Tracked Products</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ASIN</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">URL</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Current Price</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Threshold Price</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tracked By</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {products.map((product) => (
                <tr key={product._id} className="hover:bg-gray-50">
                  {editingProductId === product._id ? (
                    <>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        <input
                          type="text"
                          name="name"
                          value={editedProduct?.name || ''}
                          onChange={handleInputChange}
                          className="w-full p-1 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{product.asin}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <input
                          type="text"
                          name="url"
                          value={editedProduct?.url || ''}
                          onChange={handleInputChange}
                          className="w-full p-1 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{product.priceHistory.slice(-1)[0]?.price || 'Price data not available'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <input
                          type="number"
                          name="thresholdPrice"
                          value={editedProduct?.thresholdPrice || 0}
                          onChange={handleInputChange}
                          className="w-full p-1 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{product.trackedBy.length}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button onClick={handleSaveEdit} className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-md text-sm mr-2 transition-colors duration-200">Save</button>
                        <button onClick={handleCancelEdit} className="bg-gray-500 hover:bg-gray-600 text-white px-3 py-1 rounded-md text-sm transition-colors duration-200">Cancel</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{product.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{product.asin}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600 hover:underline"><a href={product.url} target="_blank" rel="noopener noreferrer">Link</a></td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{product.priceHistory.slice(-1)[0]?.price || 'Price data not available'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{product.thresholdPrice}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{product.trackedBy.length}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <Link href={`/dashboard/product/${product.asin}`} className="text-indigo-600 hover:text-indigo-900 mr-2">View</Link>
                        <button onClick={() => handleEditClick(product)} className="text-yellow-600 hover:text-yellow-900 mr-2">Edit</button>
                        <button onClick={() => handleDeleteProduct(product.asin)} className="text-red-600 hover:text-red-900">Delete</button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}