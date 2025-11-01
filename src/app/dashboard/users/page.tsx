'use client';

import { useState, useEffect } from 'react';

interface User {
  _id: string;
  chatId: number;
  locale: string;
  // Add other user properties as needed
}

export default function ManageUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editedUser, setEditedUser] = useState<Partial<User> | null>(null);

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/admin/users');
      if (!res.ok) {
        throw new Error(`Error: ${res.status}`);
      }
      const data = await res.json();
      setUsers(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleDeleteUser = async (_id: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return;

    try {
      const res = await fetch('/api/admin/users', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ _id }),
      });

      if (!res.ok) {
        throw new Error(`Error: ${res.status}`);
      }

      setUsers(users.filter(u => u._id !== _id));
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleEditClick = (user: User) => {
    setEditingUserId(user._id);
    setEditedUser({ ...user });
  };

  const handleCancelEdit = () => {
    setEditingUserId(null);
    setEditedUser(null);
  };

  const handleSaveEdit = async () => {
    if (!editedUser || !editingUserId) return;

    try {
      const res = await fetch('/api/admin/users', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editedUser),
      });

      if (!res.ok) {
        throw new Error(`Error: ${res.status}`);
      }

      setEditingUserId(null);
      setEditedUser(null);
      fetchUsers(); // Re-fetch users to get the latest data
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setEditedUser(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  if (loading) return <div className="p-6 text-center">Loading users...</div>;
  if (error) return <div className="p-6 text-center text-red-500">Error: {error}</div>;

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6 text-gray-800">Manage Users</h1>
      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <h2 className="text-xl font-semibold p-4 border-b border-gray-200">All Users</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Chat ID</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Locale</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map((user) => (
                <tr key={user._id} className="hover:bg-gray-50">
                  {editingUserId === user._id ? (
                    <>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{user.chatId}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <input
                          type="text"
                          name="locale"
                          value={editedUser?.locale || ''}
                          onChange={handleInputChange}
                          className="w-full p-1 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button onClick={handleSaveEdit} className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-md text-sm mr-2 transition-colors duration-200">Save</button>
                        <button onClick={handleCancelEdit} className="bg-gray-500 hover:bg-gray-600 text-white px-3 py-1 rounded-md text-sm transition-colors duration-200">Cancel</button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{user.chatId}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.locale}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button onClick={() => handleEditClick(user)} className="text-indigo-600 hover:text-indigo-900 mr-2">Edit</button>
                        <button onClick={() => handleDeleteUser(user._id)} className="text-red-600 hover:text-red-900">Delete</button>
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
