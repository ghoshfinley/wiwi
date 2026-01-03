'use client';

import { useState, useEffect } from 'react';

interface WishlistItem {
  id: number;
  title: string;
  description: string;
  url?: string;
  created_at?: string;
}

export default function Home() {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [newItem, setNewItem] = useState({ title: '', description: '', url: '' });
  const [error, setError] = useState('');

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8081';

  useEffect(() => {
    const fetchItems = async () => {
      try {
        const response = await fetch(`${API_URL}/api/items`);
        if (response.ok) {
          const data = await response.json();
          setItems(data || []);
        }
      } catch (err) {
        console.error('Failed to fetch items:', err);
      }
    };

    fetchItems();
  }, [API_URL]);

  const refreshItems = async () => {
    try {
      const response = await fetch(`${API_URL}/api/items`);
      if (response.ok) {
        const data = await response.json();
        setItems(data || []);
      }
    } catch (err) {
      console.error('Failed to fetch items:', err);
    }
  };

  const addItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!newItem.title.trim()) {
      setError('Title is required');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newItem),
      });

      if (response.ok) {
        setNewItem({ title: '', description: '', url: '' });
        refreshItems();
      } else {
        setError('Failed to add item');
      }
    } catch (err) {
      setError('Failed to add item');
      console.error(err);
    }
  };

  const deleteItem = async (id: number) => {
    try {
      const response = await fetch(`${API_URL}/api/items/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        refreshItems();
      }
    } catch (err) {
      console.error('Failed to delete item:', err);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-800 dark:text-white mb-8 text-center">
          🎁 WiWi - What I Want Is
        </h1>

        {/* Add Item Form */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-8">
          <h2 className="text-2xl font-semibold mb-4 text-gray-800 dark:text-white">Add New Wish</h2>
          <form onSubmit={addItem} className="space-y-4">
            {error && <div className="text-red-500 text-sm">{error}</div>}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Title *
              </label>
              <input
                type="text"
                value={newItem.title}
                onChange={(e) => setNewItem({ ...newItem, title: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                placeholder="What do you want?"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description
              </label>
              <textarea
                value={newItem.description}
                onChange={(e) => setNewItem({ ...newItem, description: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                placeholder="Add more details..."
                rows={3}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                URL
              </label>
              <input
                type="url"
                value={newItem.url}
                onChange={(e) => setNewItem({ ...newItem, url: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                placeholder="https://..."
              />
            </div>
            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
            >
              Add to Wishlist
            </button>
          </form>
        </div>

        {/* Wishlist Items */}
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold text-gray-800 dark:text-white mb-4">My Wishlist</h2>
          {items.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center text-gray-500 dark:text-gray-400">
              No items yet. Add your first wish above!
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-2">
                      {item.title}
                    </h3>
                    {item.description && (
                      <p className="text-gray-600 dark:text-gray-300 mb-2">{item.description}</p>
                    )}
                    {item.url && (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 dark:text-blue-400 text-sm break-all"
                      >
                        {item.url}
                      </a>
                    )}
                  </div>
                  <button
                    onClick={() => deleteItem(item.id)}
                    className="ml-4 text-red-600 hover:text-red-800 dark:text-red-400 font-semibold"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
