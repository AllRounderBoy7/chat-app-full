// Groups List Component
import React, { useState, useEffect, useCallback } from 'react';
import { GroupService, Group } from './GroupService';
import { CreateGroup } from './CreateGroup';
import { GroupChat } from './GroupChat';
import { GroupInfo } from './GroupInfo';

interface GroupsListProps {
  currentUserId: string;
  currentUserName: string;
  currentUserAvatar: string;
}

export const GroupsList: React.FC<GroupsListProps> = ({
  currentUserId,
  currentUserName,
  currentUserAvatar,
}) => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const loadGroups = useCallback(async () => {
    setIsLoading(true);
    try {
      const userGroups = await GroupService.getUserGroups(currentUserId);
      setGroups(userGroups);
    } catch (error) {
      console.error('Error loading groups:', error);
    } finally {
      setIsLoading(false);
    }
  }, [currentUserId]);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  const filteredGroups = groups.filter(
    g => g.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatTime = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  // Show Group Chat
  if (selectedGroup && !showGroupInfo) {
    return (
      <GroupChat
        group={selectedGroup}
        currentUserId={currentUserId}
        currentUserName={currentUserName}
        currentUserAvatar={currentUserAvatar}
        onBack={() => {
          setSelectedGroup(null);
          loadGroups();
        }}
        onOpenGroupInfo={() => setShowGroupInfo(true)}
      />
    );
  }

  // Show Group Info
  if (selectedGroup && showGroupInfo) {
    return (
      <GroupInfo
        group={selectedGroup}
        currentUserId={currentUserId}
        onBack={() => setShowGroupInfo(false)}
        onGroupUpdated={() => {
          GroupService.getGroup(selectedGroup.id).then(g => {
            if (g) setSelectedGroup(g);
          });
        }}
        onLeaveGroup={() => {
          setSelectedGroup(null);
          setShowGroupInfo(false);
          loadGroups();
        }}
      />
    );
  }

  // Show Create Group
  if (showCreateGroup) {
    return (
      <CreateGroup
        currentUserId={currentUserId}
        onClose={() => setShowCreateGroup(false)}
        onGroupCreated={(group) => {
          setShowCreateGroup(false);
          setSelectedGroup(group);
          loadGroups();
        }}
      />
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-100 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Groups</h1>
          <button
            onClick={() => setShowCreateGroup(true)}
            className="p-2 bg-purple-500 hover:bg-purple-600 text-white rounded-full"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search groups..."
            className="w-full px-4 py-2 pl-10 bg-gray-100 dark:bg-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
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

      {/* Groups List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full"></div>
          </div>
        ) : filteredGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-4">
            {searchQuery ? (
              <>
                <div className="text-6xl mb-4">🔍</div>
                <p className="text-gray-500 dark:text-gray-400">No groups found</p>
              </>
            ) : (
              <>
                <div className="text-6xl mb-4">👥</div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  No Groups Yet
                </h3>
                <p className="text-gray-500 dark:text-gray-400 mb-4">
                  Create a group to start chatting with multiple friends
                </p>
                <button
                  onClick={() => setShowCreateGroup(true)}
                  className="px-6 py-3 bg-purple-500 hover:bg-purple-600 text-white rounded-xl font-medium"
                >
                  Create Group
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {filteredGroups.map(group => (
              <button
                key={group.id}
                onClick={() => setSelectedGroup(group)}
                className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                {/* Group Icon */}
                {group.icon ? (
                  <img 
                    src={group.icon} 
                    alt={group.name}
                    className="w-14 h-14 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-xl font-bold">
                    {group.name.charAt(0).toUpperCase()}
                  </div>
                )}

                {/* Group Info */}
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                      {group.name}
                    </h3>
                    <span className="text-xs text-gray-500 flex-shrink-0 ml-2">
                      {formatTime(group.lastMessage?.timestamp || group.createdAt)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                      {group.lastMessage ? (
                        <>
                          <span className="font-medium">{group.lastMessage.senderName}:</span>{' '}
                          {group.lastMessage.content}
                        </>
                      ) : (
                        `${group.memberCount} members`
                      )}
                    </p>
                    {group.unreadCount > 0 && (
                      <span className="ml-2 flex-shrink-0 px-2 py-0.5 bg-purple-500 text-white text-xs rounded-full">
                        {group.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default GroupsList;
