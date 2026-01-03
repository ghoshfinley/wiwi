'use client';

import { useState, useEffect } from 'react';
import { useAuth } from './contexts/AuthContext';
import { useSearchParams } from 'next/navigation';

interface WishlistItem {
  id: number;
  title: string;
  description: string;
  url?: string;
  created_at?: string;
}

export default function Home() {
  const { user, loading: authLoading } = useAuth();
  const searchParams = useSearchParams();
  const viewingListUUID = searchParams.get('list'); // Get list UUID from URL params
  
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [newItem, setNewItem] = useState({ title: '', description: '', url: '' });
  const [error, setError] = useState('');
  const [shareableLink, setShareableLink] = useState('');

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8081';

  // Determine which list to view: authenticated user's own list or a shared list
  const listUUID = user?.uuid || viewingListUUID;
  const isOwner = user && (!viewingListUUID || viewingListUUID === user.uuid);

  useEffect(() => {
    if (!listUUID) return;

    const fetchItems = async () => {
      try {
        const response = await fetch(`${API_URL}/api/users/${listUUID}/items`);
        if (response.ok) {
          const data = await response.json();
          setItems(data || []);
        }
      } catch (err) {
        console.error('Failed to fetch items:', err);
      }
    };

    fetchItems();
  }, [API_URL, listUUID]);

  useEffect(() => {
    // Generate shareable link for authenticated users
    if (user) {
      const baseUrl = window.location.origin;
      setShareableLink(`${baseUrl}/?list=${user.uuid}`);
    }
  }, [user]);

  const refreshItems = async () => {
    if (!listUUID) return;
    
    try {
      const response = await fetch(`${API_URL}/api/users/${listUUID}/items`);
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

    if (!user) {
      setError('You must be logged in to add items');
      return;
    }

    if (!newItem.title.trim()) {
      setError('Title is required');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/users/${user.uuid}/items`, {
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
    if (!user) return;

    try {
      const response = await fetch(`${API_URL}/api/users/${user.uuid}/items/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        refreshItems();
      }
    } catch (err) {
      console.error('Failed to delete item:', err);
    }
  };

  const copyShareableLink = () => {
    navigator.clipboard.writeText(shareableLink);
    alert('Link copied to clipboard!');
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl text-gray-600">Loading...</div>
      </div>
    );
  }

  // Show message if no list is being viewed
  if (!listUUID) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold text-gray-800 dark:text-white mb-8 text-center">
            🎁 WiWi - What I Want Is
          </h1>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
            <p className="text-xl text-gray-600 dark:text-gray-300 mb-4">
              Welcome to WiWi!
            </p>
            <p className="text-gray-600 dark:text-gray-400">
              Please sign up or log in to create your wishlist.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-800 dark:text-white mb-8 text-center">
          🎁 WiWi - What I Want Is
        </h1>

        {/* Viewing mode indicator for unauthenticated users */}
        {!user && (
          <div className="bg-blue-50 dark:bg-blue-900 rounded-lg p-4 mb-6 text-center">
            <p className="text-blue-800 dark:text-blue-200">
              You're viewing someone's wishlist. <a href="/auth" className="underline font-semibold">Sign up</a> to create your own!
            </p>
          </div>
        )}

        {/* Shareable link section for list owners */}
        {isOwner && user && (
          <div className="bg-green-50 dark:bg-green-900 rounded-lg p-4 mb-6">
            <h3 className="text-sm font-semibold text-green-800 dark:text-green-200 mb-2">
              Share Your List
            </h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={shareableLink}
                readOnly
                className="flex-1 px-3 py-2 bg-white dark:bg-gray-800 border border-green-300 dark:border-green-700 rounded text-sm"
              />
              <button
                onClick={copyShareableLink}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors text-sm font-medium"
              >
                Copy Link
              </button>
            </div>
          </div>
        )}

        {/* Add Item Form - Only show for authenticated list owners */}
        {isOwner && (
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
        )}

        {/* Wishlist Items */}
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold text-gray-800 dark:text-white mb-4">
            {isOwner ? 'My Wishlist' : 'Wishlist'}
          </h2>
          {items.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center text-gray-500 dark:text-gray-400">
              {isOwner ? 'No items yet. Add your first wish above!' : 'This wishlist is empty.'}
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
                  {/* Only show delete button for list owners */}
                  {isOwner && (
                    <button
                      onClick={() => deleteItem(item.id)}
                      className="ml-4 text-red-600 hover:text-red-800 dark:text-red-400 font-semibold"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
