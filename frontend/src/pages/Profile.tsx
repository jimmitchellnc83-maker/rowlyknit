import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FiUser, FiMail, FiLock, FiSave, FiLink, FiCheck, FiXCircle } from 'react-icons/fi';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useAuthStore } from '../stores/authStore';

export default function Profile() {
  const { user, setUser } = useAuthStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<'profile' | 'password' | 'integrations'>('profile');
  const [saving, setSaving] = useState(false);

  // Ravelry connection state
  const [ravelryConnected, setRavelryConnected] = useState(false);
  const [ravelryUsername, setRavelryUsername] = useState<string | null>(null);
  const [ravelryLoading, setRavelryLoading] = useState(false);

  const [profileData, setProfileData] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  // Handle URL params for tab selection and Ravelry status
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'integrations') {
      setActiveTab('integrations');
    }

    const ravelryStatus = searchParams.get('ravelry');
    if (ravelryStatus === 'connected') {
      toast.success('Ravelry account connected successfully!');
      setSearchParams({}, { replace: true });
      setActiveTab('integrations');
    } else if (ravelryStatus === 'error') {
      toast.error('Failed to connect Ravelry account. Please try again.');
      setSearchParams({}, { replace: true });
      setActiveTab('integrations');
    }
  }, [searchParams, setSearchParams]);

  // Fetch Ravelry connection status when integrations tab is active
  useEffect(() => {
    if (activeTab === 'integrations') {
      fetchRavelryStatus();
    }
  }, [activeTab]);

  const fetchRavelryStatus = async () => {
    try {
      const response = await axios.get('/api/ravelry/oauth/status');
      if (response.data.success) {
        setRavelryConnected(response.data.data.connected);
        setRavelryUsername(response.data.data.ravelryUsername);
      }
    } catch {
      // Silently fail - user just sees disconnected state
    }
  };

  const handleConnectRavelry = async () => {
    setRavelryLoading(true);
    try {
      const response = await axios.get('/api/ravelry/oauth/authorize');
      if (response.data.success) {
        window.location.href = response.data.data.url;
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to initiate Ravelry connection.');
      setRavelryLoading(false);
    }
  };

  const handleDisconnectRavelry = async () => {
    setRavelryLoading(true);
    try {
      await axios.delete('/api/ravelry/oauth/disconnect');
      setRavelryConnected(false);
      setRavelryUsername(null);
      toast.success('Ravelry account disconnected.');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to disconnect Ravelry.');
    } finally {
      setRavelryLoading(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const response = await axios.put('/api/auth/profile', {
        firstName: profileData.firstName,
        lastName: profileData.lastName,
      });

      const updatedUser = response.data.data.user;
      setUser(updatedUser);
      toast.success('Profile updated successfully!');
    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast.error(error.response?.data?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    if (passwordData.newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    setSaving(true);

    try {
      await axios.put('/api/auth/password', {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      });

      toast.success('Password changed successfully!');
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch (error: any) {
      console.error('Error changing password:', error);
      toast.error(error.response?.data?.message || 'Failed to change password');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Profile</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">Manage your account settings</p>
      </div>

      {/* User Avatar */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6 flex items-center gap-4">
        <div className="h-16 w-16 rounded-full bg-purple-600 flex items-center justify-center text-white text-2xl font-semibold">
          {user?.firstName?.[0]}{user?.lastName?.[0]}
        </div>
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            {user?.firstName} {user?.lastName}
          </h2>
          <p className="text-gray-500 dark:text-gray-400">{user?.email}</p>
          {user?.emailVerified ? (
            <span className="inline-flex items-center text-xs text-green-600 mt-1">
              <span className="w-2 h-2 bg-green-500 rounded-full mr-1" />
              Email verified
            </span>
          ) : (
            <span className="inline-flex items-center text-xs text-orange-600 mt-1">
              <span className="w-2 h-2 bg-orange-500 rounded-full mr-1" />
              Email not verified
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
        <button
          onClick={() => setActiveTab('profile')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition ${
            activeTab === 'profile'
              ? 'bg-white dark:bg-gray-800 text-purple-600 shadow'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          <FiUser className="h-4 w-4" />
          Profile Info
        </button>
        <button
          onClick={() => setActiveTab('password')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition ${
            activeTab === 'password'
              ? 'bg-white dark:bg-gray-800 text-purple-600 shadow'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          <FiLock className="h-4 w-4" />
          Change Password
        </button>
        <button
          onClick={() => setActiveTab('integrations')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition ${
            activeTab === 'integrations'
              ? 'bg-white dark:bg-gray-800 text-purple-600 shadow'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          <FiLink className="h-4 w-4" />
          Integrations
        </button>
      </div>

      {/* Profile Info Tab */}
      {activeTab === 'profile' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  First Name
                </label>
                <input
                  type="text"
                  value={profileData.firstName}
                  onChange={(e) => setProfileData({ ...profileData, firstName: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Last Name
                </label>
                <input
                  type="text"
                  value={profileData.lastName}
                  onChange={(e) => setProfileData({ ...profileData, lastName: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                <FiMail className="inline mr-1 h-4 w-4" />
                Email Address
              </label>
              <input
                type="email"
                value={profileData.email}
                disabled
                className="w-full px-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Email changes are not supported at this time.
              </p>
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                <FiSave className="h-4 w-4" />
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Change Password Tab */}
      {activeTab === 'password' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Current Password
              </label>
              <input
                type="password"
                value={passwordData.currentPassword}
                onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                New Password
              </label>
              <input
                type="password"
                value={passwordData.newPassword}
                onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                required
                minLength={8}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Must be at least 8 characters with a mix of letters, numbers, and symbols.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Confirm New Password
              </label>
              <input
                type="password"
                value={passwordData.confirmPassword}
                onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                required
              />
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                <FiLock className="h-4 w-4" />
                {saving ? 'Changing...' : 'Change Password'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Integrations Tab */}
      {activeTab === 'integrations' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Ravelry</h3>

          {ravelryConnected ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <FiCheck className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Connected</p>
                  {ravelryUsername && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">as {ravelryUsername}</p>
                  )}
                </div>
              </div>
              <button
                onClick={handleDisconnectRavelry}
                disabled={ravelryLoading}
                className="flex items-center gap-2 px-4 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition disabled:opacity-50"
              >
                <FiXCircle className="h-4 w-4" />
                {ravelryLoading ? 'Disconnecting...' : 'Disconnect'}
              </button>
            </div>
          ) : (
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Connect your Ravelry account to search and import yarns and patterns from the Ravelry database.
              </p>
              <button
                onClick={handleConnectRavelry}
                disabled={ravelryLoading}
                className="flex items-center gap-2 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                <FiLink className="h-4 w-4" />
                {ravelryLoading ? 'Connecting...' : 'Connect to Ravelry'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
