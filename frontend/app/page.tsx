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
  interested_names: string[];
  bought_by_names: string[];
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
  const [listOwner, setListOwner] = useState<{ name: string } | null>(null);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const shareRef = useRef<HTMLDivElement | null>(null);
  const copyTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8081';

  // Determine which list to view: authenticated user's own list or a shared list
  const listUUID = viewingListUUID || user?.uuid;
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

    const fetchOwnerInfo = async () => {
      try {
        const response = await fetch(`${API_URL}/api/users/${listUUID}`);
        if (response.ok) {
          const data = await response.json();
          setListOwner({
            name: data.name
          });
          setListOwnerName(data.name);
        }
      } catch (err) {
        console.error('Failed to fetch owner info:', err);
      }
    };

    fetchItems();
    fetchOwnerInfo();
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
    if (!user || !confirm('Are you sure you want to delete this item?')) return;

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

  const handleItemAction = async (item: WishlistItem, action: 'interest' | 'buy') => {
    const isBought = item.bought_by_names?.length > 0;

    // 1. Check if item is already bought
    if (action === 'buy' && isBought) {
      if (!confirm('This item has already been marked as bought by someone else. Are you sure you want to mark it as bought as well?')) {
        return;
      }
    }

    // 2. Get name
    let name = user?.name || '';
    if (!name) {
      const enteredName = prompt('Please enter your name:');
      if (!enteredName) return;
      name = enteredName;
    }

    // 3. Perform action
    try {
      const response = await fetch(`${API_URL}/api/items/${item.id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (response.ok) {
        refreshItems();
      }
    } catch (err) {
      console.error(`Failed to ${action} item:`, err);
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
            <a href="/auth" className="inline-block mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
              Get Started
            </a>
          </div>
        </div>
      </div>
    );
  }

  const displayTitle = listOwner
    ? `${listOwner.name}'s Wishlist`
    : 'Wishlist';

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <a href="/" className="text-2xl font-bold text-blue-600">
            WiWi
          </a>
           <div className="flex items-center justify-center gap-2">
            <h2 className="text-2xl font-semibold text-gray-700 dark:text-gray-300">
              {displayTitle}
            </h2>
          </div>
          
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
                    <AddIcon sx={{ fontSize: 28 }} />
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
                      <LinkIcon sx={{ fontSize: 28 }} />
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
                            {copied ? <CheckCircleIcon sx={{ fontSize: 20 }} /> : <ContentCopyIcon sx={{ fontSize: 20 }} />}
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
              items.map((item) => {
                const isBought = item.bought_by_names?.length > 0;
                const isInterested = item.interested_names?.length > 0;

                return (
                  <div
                    key={item.id}
                    className={`bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow border-l-4 ${isBought ? 'border-green-500' : 'border-blue-500'}`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <h3 className={`text-xl font-semibold dark:text-white ${isBought ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                            {item.title}
                          </h3>
                          {isBought && (
                            <span className="bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded-full font-medium" title={`Bought by: ${item.bought_by_names?.join(', ')}`}>
                              Bought {item.bought_by_names?.length > 0 ? `by ${item.bought_by_names.join(', ')}` : ''}
                            </span>
                          )}
                          {isInterested && !isBought && (
                            <span className="bg-orange-100 text-orange-800 text-xs px-2 py-0.5 rounded-full font-medium" title={`Interested: ${item.interested_names.join(', ')}`}>
                              {item.interested_names.length} Interested
                            </span>
                          )}
                        </div>
                        {item.description && (
                          <p className={`mb-2 ${isBought ? 'text-gray-400' : 'text-gray-600 dark:text-gray-300'}`}>
                            {item.description}
                          </p>
                        )}
                        {item.url && (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`text-sm break-all ${isBought ? 'text-gray-300 dark:text-gray-600 pointer-events-none' : 'text-blue-600 hover:text-blue-800 dark:text-blue-400'}`}
                          >
                            {item.url}
                          </a>
                        )}
                        {/* Detailed Name List */}
                        {isInterested && !isBought && (
                          <p className="mt-2 text-xs text-orange-600 dark:text-orange-400 italic">
                            Interested: {item.interested_names.join(', ')}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-col gap-2 ml-4">
                        {isOwner ? (
                          <button
                            onClick={() => deleteItem(item.id)}
                            className="text-red-600 hover:text-red-800 dark:text-red-400 font-semibold text-sm"
                          >
                            Delete
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => handleItemAction(item, 'interest')}
                              className="px-3 py-1.5 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 transition-colors text-sm font-medium whitespace-nowrap"
                            >
                              I am interested
                            </button>
                            <button
                              onClick={() => handleItemAction(item, 'buy')}
                              className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium whitespace-nowrap"
                            >
                              I have bought this
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
