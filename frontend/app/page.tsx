'use client';

import { useState, useEffect, useRef } from 'react';
import LinkIcon from '@mui/icons-material/Link';
import AddIcon from '@mui/icons-material/Add';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useAuth } from './contexts/AuthContext';
import { useSearchParams } from 'next/navigation';
import AddItemForm from './components/AddItemForm';

interface WishlistItem {
  id: number;
  title: string;
  description: string;
  url?: string;
  created_at?: string;
}

export default function Home() {
  const { user, loading: authLoading, logout } = useAuth();
  const searchParams = useSearchParams();
  const viewingListUUID = searchParams.get('list'); // Get list UUID from URL params
  
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [error, setError] = useState('');
  const [shareableLink, setShareableLink] = useState('');
  const [isAddFormOpen, setIsAddFormOpen] = useState(false);
  const [listOwnerName, setListOwnerName] = useState<string>('');
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const shareRef = useRef<HTMLDivElement | null>(null);
  const copyTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

    // Generate shareable link for authenticated users
    if (user) {
      setShareableLink(`${baseUrl}/?list=${user.uuid}`);
      setListOwnerName(user.name || user.email);
    } else if (viewingListUUID) {
      // Generate shareable link for viewers of a shared list
      setShareableLink(`${baseUrl}/?list=${viewingListUUID}`);
      setListOwnerName('');
    }
  }, [user, viewingListUUID]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (isShareOpen && shareRef.current && !shareRef.current.contains(event.target as Node)) {
        setIsShareOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isShareOpen]);

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

  const addItem = async (newItem: { title: string; description: string; url: string }) => {
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
        refreshItems();
        setIsAddFormOpen(false);
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
    if (!shareableLink) return;
    navigator.clipboard.writeText(shareableLink);
    setCopied(true);
    if (copyTimeoutRef.current) {
      clearTimeout(copyTimeoutRef.current);
    }
    copyTimeoutRef.current = setTimeout(() => setCopied(false), 5000);
  };

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
    };
  }, []);

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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <a href="/" className="text-2xl font-bold text-blue-600">
            WiWi
          </a>
          <div className="flex items-center gap-4">
            {user ? (
              <>
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Hello, {user.name || user.email}
                </span>
                <button
                  onClick={logout}
                  className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
                >
                  Logout
                </button>
              </>
            ) : (
              <a
                href="/auth"
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Sign Up / Login
              </a>
            )}
          </div>
        </div>
      </header>

      <div className="p-8">
        <div className="max-w-4xl mx-auto">
          {/* Wishlist Items */}
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-semibold text-gray-800 dark:text-white">
                {isOwner ? 'My Wishlist' : (listOwnerName ? `${listOwnerName}'s Wishlist` : 'Wishlist')}
              </h2>
              <div className="flex items-center gap-3 mt-2 relative">
                {/* Add icon for list owners */}
                {isOwner && user && (
                  <button
                    onClick={() => setIsAddFormOpen(true)}
                    title="Add item to list"
                    className="text-white hover:text-blue-200 transition-colors"
                    aria-label="Add item"
                  >
                    <AddIcon fontSize="large" />
                  </button>
                )}
                {/* Share button for all users */}
                {(isOwner || !user) && (
                  <div
                    className="flex items-center gap-2 relative"
                    ref={shareRef}
                  >
                    <button
                      title="Share link"
                      className="text-white hover:text-blue-200 transition-colors"
                      aria-label="Toggle share link"
                      onClick={() => setIsShareOpen((open) => !open)}
                    >
                      <LinkIcon fontSize="large" />
                    </button>
                    {isShareOpen && (
                      <div className="absolute right-0 top-8 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 shadow-lg rounded-lg px-4 py-3 w-72 border border-gray-100 dark:border-gray-700 flex flex-col gap-3">
                        <div className="text-sm font-semibold">Share your WiWi</div>
                        <div className="flex items-center gap-2">
                          <input
                            readOnly
                            value={shareableLink || 'No link available'}
                            onFocus={(e) => e.target.select()}
                            className="w-full h-9 text-xs text-gray-700 dark:text-gray-200 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded px-2"
                          />
                          <button
                            onClick={copyShareableLink}
                            disabled={!shareableLink}
                            className="h-9 w-10 bg-blue-600 disabled:bg-gray-400 text-white rounded hover:bg-blue-500 transition-colors flex items-center justify-center"
                            aria-label="Copy shareable link"
                          >
                            {copied ? <CheckCircleIcon fontSize="medium" /> : <ContentCopyIcon fontSize="medium" />}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            {/* Add Item Form - Only show for authenticated list owners */}
            {isOwner && (
              <div className="mb-6">
                {error && (
                  <div className="text-red-500 text-sm bg-red-50 dark:bg-red-900 p-3 rounded mb-4">
                    {error}
                  </div>
                )}
                <AddItemForm
                  isOpen={isAddFormOpen}
                  onAdd={addItem}
                  onCancel={() => setIsAddFormOpen(false)}
                />
              </div>
            )}
            {items.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center text-gray-500 dark:text-gray-400">
                {isOwner ? 'No items yet. Add your first wish using the + button!' : 'This wishlist is empty.'}
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
    </div>
  );
}
