'use client';

import { useState } from 'react';

interface AddItemFormProps {
  onAdd: (item: { title: string; description: string; url: string }) => void;
  onCancel: () => void;
  isOpen: boolean;
}

export default function AddItemForm({ onAdd, onCancel, isOpen }: AddItemFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [url, setUrl] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);

  const handleSubmit = () => {
    if (title.trim()) {
      onAdd({ title, description, url });
      setTitle('');
      setDescription('');
      setUrl('');
      setIsExpanded(false);
    }
  };

  const handleCancel = () => {
    setTitle('');
    setDescription('');
    setUrl('');
    setIsExpanded(false);
    onCancel();
  };

  if (!isOpen) return null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-8 border-2 border-blue-400">
      <div className="flex flex-col">
        {/* Title Input */}
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What do you want?"
          className="text-lg font-semibold text-gray-800 dark:text-white bg-transparent outline-none mb-4 placeholder-gray-400"
          autoFocus
        />

        {/* Expandable Section */}
        {!isExpanded && title.trim() && (
          <button
            onClick={() => setIsExpanded(true)}
            className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 text-left mb-4 transition-colors"
          >
            + Add description & link
          </button>
        )}

        {/* Expanded Content */}
        {isExpanded && (
          <div className="space-y-3 mb-4">
            <div>
              <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add more details..."
                className="w-full px-3 py-2 border border-gray-300 rounded bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                rows={2}
              />
            </div>
            <div>
              <label className="text-xs text-gray-600 dark:text-gray-400 mb-1 block">
                Link
              </label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-3 py-2 border border-gray-300 rounded bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end gap-2">
          <button
            onClick={handleCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            Discard
          </button>
          <button
            onClick={handleSubmit}
            disabled={!title.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            Add Item
          </button>
        </div>
      </div>
    </div>
  );
}
