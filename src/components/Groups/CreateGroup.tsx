// Create Group Component
import React, { useState } from 'react';
import { GroupService, Group } from './GroupService';

import { useAppStore } from '@/store/appStore';

interface CreateGroupProps {
  currentUserId: string;
  onClose: () => void;
  onGroupCreated: (group: Group) => void;
}

export const CreateGroup: React.FC<CreateGroupProps> = ({
  currentUserId,
  onClose,
  onGroupCreated,
}) => {
  const { friends: storeFriends } = useAppStore();
  const [step, setStep] = useState<1 | 2>(1);
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [groupIcon, setGroupIcon] = useState<string | null>(null);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Use real friends list
  const friends = storeFriends.map(f => ({
    id: f.id,
    name: f.display_name,
    username: f.username,
    avatar: f.avatar_url || ''
  }));

  const filteredFriends = friends.filter(
    f => f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleIconUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setGroupIcon(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreate = async () => {
    if (!groupName.trim()) {
      alert('Please enter a group name');
      return;
    }

    setIsCreating(true);
    try {
      const group = await GroupService.createGroup(
        groupName.trim(),
        groupDescription.trim(),
        groupIcon,
        selectedMembers,
        currentUserId
      );
      onGroupCreated(group);
    } catch (error) {
      console.error('Error creating group:', error);
      alert(error instanceof Error ? error.message : 'Failed to create group');
    } finally {
      setIsCreating(false);
    }
  };

  const toggleMember = (memberId: string) => {
    if (selectedMembers.includes(memberId)) {
      setSelectedMembers(selectedMembers.filter(id => id !== memberId));
    } else {
      setSelectedMembers([...selectedMembers, memberId]);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={step === 1 ? onClose : () => setStep(1)}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="text-lg font-semibold flex-1">
          {step === 1 ? 'New Group' : 'Add Members'}
        </h2>
        {step === 2 && (
          <button
            onClick={handleCreate}
            disabled={isCreating || !groupName.trim()}
            className="px-4 py-2 bg-purple-500 hover:bg-purple-600 disabled:bg-gray-300 text-white rounded-lg font-medium"
          >
            {isCreating ? 'Creating...' : 'Create'}
          </button>
        )}
      </div>

      {/* Step 1: Group Info */}
      {step === 1 && (
        <div className="flex-1 overflow-y-auto">
          {/* Group Icon */}
          <div className="flex justify-center py-8">
            <div className="relative">
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleIconUpload}
                  className="hidden"
                />
                {groupIcon ? (
                  <img
                    src={groupIcon}
                    alt="Group icon"
                    className="w-24 h-24 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                    <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                )}
                <div className="absolute bottom-0 right-0 p-2 bg-purple-500 rounded-full text-white">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
              </label>
            </div>
          </div>

          {/* Group Name */}
          <div className="px-4 pb-4">
            <label className="block text-sm font-medium mb-2">Group Name *</label>
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Enter group name"
              maxLength={50}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-transparent focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <p className="text-xs text-gray-500 mt-1 text-right">{groupName.length}/50</p>
          </div>

          {/* Group Description */}
          <div className="px-4 pb-4">
            <label className="block text-sm font-medium mb-2">Description (optional)</label>
            <textarea
              value={groupDescription}
              onChange={(e) => setGroupDescription(e.target.value)}
              placeholder="What's this group about?"
              maxLength={200}
              rows={3}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-transparent focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
            />
            <p className="text-xs text-gray-500 mt-1 text-right">{groupDescription.length}/200</p>
          </div>

          {/* Next Button */}
          <div className="px-4 pb-4">
            <button
              onClick={() => setStep(2)}
              disabled={!groupName.trim()}
              className="w-full py-3 bg-purple-500 hover:bg-purple-600 disabled:bg-gray-300 text-white rounded-xl font-medium"
            >
              Next: Add Members
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Select Members */}
      {step === 2 && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Selected Members */}
          {selectedMembers.length > 0 && (
            <div className="p-4 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2 overflow-x-auto">
                {selectedMembers.map(memberId => {
                  const friend = friends.find(f => f.id === memberId);
                  return (
                    <div
                      key={memberId}
                      className="flex-shrink-0 flex items-center gap-2 px-3 py-1 bg-purple-100 dark:bg-purple-900/30 rounded-full"
                    >
                      <span className="text-sm text-purple-700 dark:text-purple-300">
                        {friend?.name}
                      </span>
                      <button
                        onClick={() => toggleMember(memberId)}
                        className="text-purple-500 hover:text-purple-700"
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {selectedMembers.length} member{selectedMembers.length !== 1 ? 's' : ''} selected
              </p>
            </div>
          )}

          {/* Search */}
          <div className="p-4">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search friends..."
                className="w-full px-4 py-3 pl-10 border border-gray-300 dark:border-gray-600 rounded-xl bg-transparent focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <svg
                className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>

          {/* Friends List */}
          <div className="flex-1 overflow-y-auto px-4">
            {filteredFriends.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                {searchQuery ? 'No friends found' : 'No friends available'}
              </div>
            ) : (
              filteredFriends.map(friend => (
                <button
                  key={friend.id}
                  onClick={() => toggleMember(friend.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl mb-2 transition-colors ${selectedMembers.includes(friend.id)
                      ? 'bg-purple-50 dark:bg-purple-900/30'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                >
                  {/* Avatar */}
                  {friend.avatar ? (
                    <img
                      src={friend.avatar}
                      alt={friend.name}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold">
                      {friend.name.charAt(0)}
                    </div>
                  )}

                  {/* Info */}
                  <div className="flex-1 text-left">
                    <p className="font-medium text-gray-900 dark:text-white">{friend.name}</p>
                    <p className="text-sm text-gray-500">@{friend.username}</p>
                  </div>

                  {/* Checkbox */}
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${selectedMembers.includes(friend.id)
                      ? 'bg-purple-500 border-purple-500'
                      : 'border-gray-300 dark:border-gray-600'
                    }`}>
                    {selectedMembers.includes(friend.id) && (
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Create without members option */}
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-500 text-center">
              You can add members later
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreateGroup;
