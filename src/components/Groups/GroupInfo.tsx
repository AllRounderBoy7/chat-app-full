// Group Info Component - Manage Group Settings and Members
import React, { useState } from 'react';
import { GroupService, Group, GroupMember, GroupSettings } from './GroupService';

interface GroupInfoProps {
  group: Group;
  currentUserId: string;
  onBack: () => void;
  onGroupUpdated: () => void;
  onLeaveGroup: () => void;
}

export const GroupInfo: React.FC<GroupInfoProps> = ({
  group,
  currentUserId,
  onBack,
  onGroupUpdated,
  onLeaveGroup,
}) => {
  const [activeTab, setActiveTab] = useState<'info' | 'members' | 'settings' | 'media'>('info');
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(group.name);
  const [editDescription, setEditDescription] = useState(group.description);
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [showMemberActions, setShowMemberActions] = useState<GroupMember | null>(null);

  const currentMember = group.members.find(m => m.oderId === currentUserId);
  const isAdmin = currentMember?.role === 'owner' || currentMember?.role === 'admin';
  const isOwner = currentMember?.role === 'owner';

  const handleSaveInfo = async () => {
    try {
      await GroupService.updateGroupInfo(group.id, {
        name: editName,
        description: editDescription,
      }, currentUserId);
      onGroupUpdated();
      setIsEditing(false);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to update group info');
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    try {
      await GroupService.removeMember(group.id, memberId, currentUserId);
      onGroupUpdated();
      setShowMemberActions(null);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to remove member');
    }
  };

  const handleChangeRole = async (memberId: string, newRole: 'admin' | 'member') => {
    try {
      await GroupService.changeRole(group.id, memberId, newRole, currentUserId);
      onGroupUpdated();
      setShowMemberActions(null);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to change role');
    }
  };

  const handleMuteMember = async (memberId: string, mute: boolean) => {
    try {
      await GroupService.muteMember(group.id, memberId, mute, 24, currentUserId);
      onGroupUpdated();
      setShowMemberActions(null);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to mute member');
    }
  };

  const handleUpdateSettings = async (updates: Partial<GroupSettings>) => {
    try {
      await GroupService.updateGroupSettings(group.id, updates, currentUserId);
      onGroupUpdated();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to update settings');
    }
  };

  const handleLeaveGroup = async () => {
    if (!confirm('Are you sure you want to leave this group?')) return;
    try {
      await GroupService.leaveGroup(group.id, currentUserId);
      onLeaveGroup();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to leave group');
    }
  };

  const handleDeleteGroup = async () => {
    if (!confirm('Are you sure you want to delete this group? This cannot be undone.')) return;
    try {
      await GroupService.deleteGroup(group.id, currentUserId);
      onLeaveGroup();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to delete group');
    }
  };

  const handleResetInviteLink = async () => {
    try {
      const newLink = await GroupService.resetInviteLink(group.id, currentUserId);
      alert(`New invite link: ${newLink}`);
      onGroupUpdated();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to reset invite link');
    }
  };

  const copyInviteLink = () => {
    navigator.clipboard.writeText(group.settings.inviteLink);
    alert('Invite link copied!');
  };

  return (
    <div className="flex flex-col h-full bg-gray-100 dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <button onClick={onBack} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="text-lg font-semibold">Group Info</h2>
      </div>

      {/* Group Header */}
      <div className="bg-white dark:bg-gray-800 p-6 flex flex-col items-center">
        <div className="relative mb-4">
          {group.icon ? (
            <img src={group.icon} alt={group.name} className="w-24 h-24 rounded-full object-cover" />
          ) : (
            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-3xl font-bold">
              {group.name.charAt(0).toUpperCase()}
            </div>
          )}
          {isAdmin && (
            <button className="absolute bottom-0 right-0 p-2 bg-purple-500 rounded-full text-white">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          )}
        </div>

        {isEditing ? (
          <div className="w-full max-w-sm space-y-3">
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent text-center"
              placeholder="Group name"
            />
            <textarea
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent resize-none"
              placeholder="Group description"
              rows={2}
            />
            <div className="flex gap-2">
              <button
                onClick={() => setIsEditing(false)}
                className="flex-1 py-2 border border-gray-300 dark:border-gray-600 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveInfo}
                className="flex-1 py-2 bg-purple-500 text-white rounded-lg"
              >
                Save
              </button>
            </div>
          </div>
        ) : (
          <>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">{group.name}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">Group · {group.memberCount} members</p>
            {group.description && (
              <p className="mt-2 text-center text-gray-600 dark:text-gray-300">{group.description}</p>
            )}
            {isAdmin && (
              <button
                onClick={() => setIsEditing(true)}
                className="mt-3 text-sm text-purple-500 hover:underline"
              >
                Edit Group Info
              </button>
            )}
          </>
        )}
      </div>

      {/* Tabs */}
      <div className="flex bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        {['info', 'members', 'settings', 'media'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as typeof activeTab)}
            className={`flex-1 py-3 text-sm font-medium capitalize ${
              activeTab === tab
                ? 'text-purple-500 border-b-2 border-purple-500'
                : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Info Tab */}
        {activeTab === 'info' && (
          <div className="p-4 space-y-4">
            {/* Invite Link */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4">
              <h4 className="font-medium mb-2">Invite Link</h4>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={group.settings.inviteLink}
                  readOnly
                  className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm"
                />
                <button
                  onClick={copyInviteLink}
                  className="px-3 py-2 bg-purple-500 text-white rounded-lg text-sm"
                >
                  Copy
                </button>
              </div>
              {isAdmin && (
                <button
                  onClick={handleResetInviteLink}
                  className="mt-2 text-sm text-red-500 hover:underline"
                >
                  Reset Link
                </button>
              )}
            </div>

            {/* Notifications */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Mute Notifications</h4>
                  <p className="text-sm text-gray-500">Silence all notifications</p>
                </div>
                <button
                  className={`w-12 h-6 rounded-full transition-colors ${
                    group.isMuted ? 'bg-purple-500' : 'bg-gray-300'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white shadow transform transition-transform ${
                    group.isMuted ? 'translate-x-6' : 'translate-x-0.5'
                  }`} />
                </button>
              </div>
            </div>

            {/* Created By */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4">
              <h4 className="font-medium mb-1">Created</h4>
              <p className="text-sm text-gray-500">
                {new Date(group.createdAt).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>

            {/* Leave/Delete Group */}
            <div className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden">
              <button
                onClick={handleLeaveGroup}
                className="w-full p-4 text-left text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                🚪 Exit Group
              </button>
              {isOwner && (
                <button
                  onClick={handleDeleteGroup}
                  className="w-full p-4 text-left text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 border-t border-gray-200 dark:border-gray-700"
                >
                  🗑️ Delete Group
                </button>
              )}
            </div>
          </div>
        )}

        {/* Members Tab */}
        {activeTab === 'members' && (
          <div className="p-4">
            {/* Add Members Button */}
            {(isAdmin || group.settings.whoCanAddMembers === 'all') && (
              <button
                onClick={() => setShowAddMembers(true)}
                className="w-full p-4 bg-white dark:bg-gray-800 rounded-xl mb-4 flex items-center gap-3 text-purple-500"
              >
                <span className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                  +
                </span>
                <span className="font-medium">Add Members</span>
              </button>
            )}

            {/* Members List */}
            <div className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden">
              <div className="px-4 py-2 text-sm text-gray-500 bg-gray-50 dark:bg-gray-700/50">
                {group.memberCount} members
              </div>
              {group.members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center gap-3 p-4 border-t border-gray-100 dark:border-gray-700"
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold">
                    {member.user?.displayName?.charAt(0) || member.oderId.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 dark:text-white">
                        {member.user?.displayName || member.oderId}
                        {member.oderId === currentUserId && ' (You)'}
                      </span>
                      {member.role === 'owner' && (
                        <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded-full">Owner</span>
                      )}
                      {member.role === 'admin' && (
                        <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full">Admin</span>
                      )}
                      {member.isMuted && (
                        <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">Muted</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">
                      {member.user?.username || 'Unknown'}
                    </p>
                  </div>
                  {isAdmin && member.oderId !== currentUserId && member.role !== 'owner' && (
                    <button
                      onClick={() => setShowMemberActions(member)}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div className="p-4 space-y-4">
            {!isAdmin ? (
              <div className="text-center py-8 text-gray-500">
                Only admins can change group settings
              </div>
            ) : (
              <>
                {/* Permissions */}
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4">
                  <h4 className="font-medium mb-4">Permissions</h4>
                  
                  <SettingItem
                    label="Who can send messages"
                    value={group.settings.whoCanSendMessages}
                    options={['all', 'admins_only']}
                    onChange={(v) => handleUpdateSettings({ whoCanSendMessages: v as 'all' | 'admins_only' })}
                  />
                  
                  <SettingItem
                    label="Who can add members"
                    value={group.settings.whoCanAddMembers}
                    options={['all', 'admins_only']}
                    onChange={(v) => handleUpdateSettings({ whoCanAddMembers: v as 'all' | 'admins_only' })}
                  />
                  
                  <SettingItem
                    label="Who can edit group info"
                    value={group.settings.whoCanEditGroupInfo}
                    options={['all', 'admins_only']}
                    onChange={(v) => handleUpdateSettings({ whoCanEditGroupInfo: v as 'all' | 'admins_only' })}
                  />
                </div>

                {/* Features */}
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4">
                  <h4 className="font-medium mb-4">Features</h4>
                  
                  <ToggleItem
                    label="Disappearing Messages"
                    description="Messages will be deleted after a set time"
                    value={group.settings.disappearingMessages}
                    onChange={(v) => handleUpdateSettings({ disappearingMessages: v })}
                  />
                  
                  {group.settings.disappearingMessages && (
                    <div className="ml-4 mt-2">
                      <label className="text-sm text-gray-500">Duration (hours)</label>
                      <input
                        type="number"
                        value={group.settings.disappearingDuration}
                        onChange={(e) => handleUpdateSettings({ disappearingDuration: parseInt(e.target.value) || 24 })}
                        className="w-full mt-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent"
                        min="1"
                        max="168"
                      />
                    </div>
                  )}
                  
                  <ToggleItem
                    label="Slow Mode"
                    description="Limit how often members can send messages"
                    value={group.settings.slowMode}
                    onChange={(v) => handleUpdateSettings({ slowMode: v })}
                  />
                  
                  {group.settings.slowMode && (
                    <div className="ml-4 mt-2">
                      <label className="text-sm text-gray-500">Interval (seconds)</label>
                      <input
                        type="number"
                        value={group.settings.slowModeInterval}
                        onChange={(e) => handleUpdateSettings({ slowModeInterval: parseInt(e.target.value) || 10 })}
                        className="w-full mt-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent"
                        min="5"
                        max="3600"
                      />
                    </div>
                  )}
                  
                  <ToggleItem
                    label="Approve New Members"
                    description="Admins must approve new members"
                    value={group.settings.approveNewMembers}
                    onChange={(v) => handleUpdateSettings({ approveNewMembers: v })}
                  />
                </div>

                {/* Limits */}
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4">
                  <h4 className="font-medium mb-4">Limits</h4>
                  
                  <div className="mb-4">
                    <label className="text-sm text-gray-500">Max Members</label>
                    <input
                      type="number"
                      value={group.settings.maxMembers}
                      onChange={(e) => handleUpdateSettings({ maxMembers: parseInt(e.target.value) || 256 })}
                      className="w-full mt-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent"
                      min="2"
                      max="1000"
                    />
                  </div>
                  
                  <div>
                    <label className="text-sm text-gray-500">Max File Size (MB)</label>
                    <input
                      type="number"
                      value={group.settings.maxFileSize}
                      onChange={(e) => handleUpdateSettings({ maxFileSize: parseInt(e.target.value) || 100 })}
                      className="w-full mt-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent"
                      min="1"
                      max="500"
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Media Tab */}
        {activeTab === 'media' && (
          <div className="p-4">
            <div className="text-center py-8 text-gray-500">
              Shared media will appear here
            </div>
          </div>
        )}
      </div>

      {/* Member Actions Modal */}
      {showMemberActions && (
        <div 
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
          onClick={() => setShowMemberActions(null)}
        >
          <div 
            className="w-full max-w-md bg-white dark:bg-gray-800 rounded-t-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-center">
                {showMemberActions.user?.displayName || showMemberActions.oderId}
              </h3>
            </div>
            <div className="py-2">
              {showMemberActions.role === 'admin' ? (
                <button
                  onClick={() => handleChangeRole(showMemberActions.oderId, 'member')}
                  className="w-full px-4 py-3 text-left hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  Remove as Admin
                </button>
              ) : (
                <button
                  onClick={() => handleChangeRole(showMemberActions.oderId, 'admin')}
                  className="w-full px-4 py-3 text-left hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  Make Admin
                </button>
              )}
              {showMemberActions.isMuted ? (
                <button
                  onClick={() => handleMuteMember(showMemberActions.oderId, false)}
                  className="w-full px-4 py-3 text-left hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  Unmute
                </button>
              ) : (
                <button
                  onClick={() => handleMuteMember(showMemberActions.oderId, true)}
                  className="w-full px-4 py-3 text-left hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  Mute for 24 hours
                </button>
              )}
              <button
                onClick={() => handleRemoveMember(showMemberActions.oderId)}
                className="w-full px-4 py-3 text-left hover:bg-gray-100 dark:hover:bg-gray-700 text-red-500"
              >
                Remove from Group
              </button>
            </div>
            <button
              onClick={() => setShowMemberActions(null)}
              className="w-full p-4 border-t border-gray-200 dark:border-gray-700 font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Add Members Modal */}
      {showAddMembers && (
        <AddMembersModal
          groupId={group.id}
          existingMemberIds={group.members.map(m => m.oderId)}
          currentUserId={currentUserId}
          onClose={() => setShowAddMembers(false)}
          onMembersAdded={onGroupUpdated}
        />
      )}
    </div>
  );
};

// Helper Components
const SettingItem: React.FC<{
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}> = ({ label, value, options, onChange }) => (
  <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
    <span className="text-sm">{label}</span>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent text-sm"
    >
      {options.map(opt => (
        <option key={opt} value={opt}>
          {opt === 'all' ? 'Everyone' : opt === 'admins_only' ? 'Admins Only' : opt}
        </option>
      ))}
    </select>
  </div>
);

const ToggleItem: React.FC<{
  label: string;
  description: string;
  value: boolean;
  onChange: (value: boolean) => void;
}> = ({ label, description, value, onChange }) => (
  <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-700 last:border-0">
    <div>
      <span className="text-sm font-medium">{label}</span>
      <p className="text-xs text-gray-500">{description}</p>
    </div>
    <button
      onClick={() => onChange(!value)}
      className={`w-12 h-6 rounded-full transition-colors ${
        value ? 'bg-purple-500' : 'bg-gray-300'
      }`}
    >
      <div className={`w-5 h-5 rounded-full bg-white shadow transform transition-transform ${
        value ? 'translate-x-6' : 'translate-x-0.5'
      }`} />
    </button>
  </div>
);

// Add Members Modal
const AddMembersModal: React.FC<{
  groupId: string;
  existingMemberIds: string[];
  currentUserId: string;
  onClose: () => void;
  onMembersAdded: () => void;
}> = ({ groupId, existingMemberIds, currentUserId, onClose, onMembersAdded }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isAdding, setIsAdding] = useState(false);

  // In a real app, this would search from contacts/friends
  const availableUsers = [
    { id: 'user1', name: 'John Doe', username: 'johndoe' },
    { id: 'user2', name: 'Jane Smith', username: 'janesmith' },
    { id: 'user3', name: 'Bob Wilson', username: 'bobwilson' },
  ].filter(u => !existingMemberIds.includes(u.id) && u.id !== currentUserId);

  const filteredUsers = availableUsers.filter(
    u => u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
         u.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAdd = async () => {
    if (selectedIds.length === 0) return;
    setIsAdding(true);
    try {
      await GroupService.addMembers(groupId, selectedIds, currentUserId);
      onMembersAdded();
      onClose();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to add members');
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl max-h-[80vh] flex flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Add Members</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
            ✕
          </button>
        </div>

        <div className="p-4">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search friends..."
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-transparent"
          />
        </div>

        <div className="flex-1 overflow-y-auto px-4">
          {filteredUsers.map(user => (
            <label
              key={user.id}
              className="flex items-center gap-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg cursor-pointer"
            >
              <input
                type="checkbox"
                checked={selectedIds.includes(user.id)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedIds([...selectedIds, user.id]);
                  } else {
                    setSelectedIds(selectedIds.filter(id => id !== user.id));
                  }
                }}
                className="w-5 h-5 rounded border-gray-300"
              />
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold">
                {user.name.charAt(0)}
              </div>
              <div>
                <p className="font-medium">{user.name}</p>
                <p className="text-sm text-gray-500">@{user.username}</p>
              </div>
            </label>
          ))}
          {filteredUsers.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No users found
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleAdd}
            disabled={selectedIds.length === 0 || isAdding}
            className="w-full py-3 bg-purple-500 hover:bg-purple-600 disabled:bg-gray-300 text-white rounded-lg font-medium"
          >
            {isAdding ? 'Adding...' : `Add ${selectedIds.length} Member${selectedIds.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default GroupInfo;
