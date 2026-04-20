import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FiUser, FiMail, FiLock, FiSave, FiLink, FiCheck, FiXCircle, FiSliders, FiRefreshCw, FiHeart } from 'react-icons/fi';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useAuthStore } from '../stores/authStore';

type ProfileTab = 'profile' | 'password' | 'units' | 'integrations';

export default function Profile() {
  const { user, setUser } = useAuthStore();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<ProfileTab>('profile');
  const [saving, setSaving] = useState(false);

  const changeTab = (tab: ProfileTab) => {
    setActiveTab(tab);
    const next = new URLSearchParams(searchParams);
    if (tab === 'profile') {
      next.delete('tab');
    } else {
      next.set('tab', tab);
    }
    setSearchParams(next, { replace: true });
  };

  // Ravelry connection state
  const [ravelryConnected, setRavelryConnected] = useState(false);
  const [ravelryUsername, setRavelryUsername] = useState<string | null>(null);
  const [ravelryLoading, setRavelryLoading] = useState(false);

  const [unitPrefs, setUnitPrefs] = useState<Record<string, string>>({
    needleSizeFormat: user?.preferences?.measurements?.needleSizeFormat || 'us',
    lengthUnit: user?.preferences?.measurements?.lengthUnit || 'in',
    yarnQuantityUnit: user?.preferences?.measurements?.yarnQuantityUnit || 'yd',
    yarnWeightUnit: user?.preferences?.measurements?.yarnWeightUnit || 'g',
    gaugeBase: user?.preferences?.measurements?.gaugeBase || '4in',
  });
  const [savingUnits, setSavingUnits] = useState(false);

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
    if (tab === 'integrations' || tab === 'password' || tab === 'units' || tab === 'profile') {
      setActiveTab(tab);
    }

    const ravelryStatus = searchParams.get('ravelry');
    if (ravelryStatus === 'connected') {
      toast.success('Ravelry account connected successfully!');
      setSearchParams({ tab: 'integrations' }, { replace: true });
      setActiveTab('integrations');
    } else if (ravelryStatus === 'error') {
      toast.error('Failed to connect Ravelry account. Please try again.');
      setSearchParams({ tab: 'integrations' }, { replace: true });
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
          onClick={() => changeTab('profile')}
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
          onClick={() => changeTab('password')}
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
          onClick={() => changeTab('units')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition ${
            activeTab === 'units'
              ? 'bg-white dark:bg-gray-800 text-purple-600 shadow'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
          }`}
        >
          <FiSliders className="h-4 w-4" />
          Units
        </button>
        <button
          onClick={() => changeTab('integrations')}
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

      {/* Units Tab */}
      {activeTab === 'units' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Measurement Preferences</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            Choose how measurements are displayed throughout the app.
          </p>
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Needle / Hook Size Format
              </label>
              <select
                value={unitPrefs.needleSizeFormat}
                onChange={(e) => setUnitPrefs({ ...unitPrefs, needleSizeFormat: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                <option value="us">US (e.g. US 7)</option>
                <option value="mm">Metric mm (e.g. 4.5 mm)</option>
                <option value="uk">UK (e.g. UK 7)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Needle / Hook Length Display
              </label>
              <select
                value={unitPrefs.lengthUnit}
                onChange={(e) => setUnitPrefs({ ...unitPrefs, lengthUnit: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                <option value="in">Inches (in)</option>
                <option value="cm">Centimeters (cm)</option>
                <option value="mm">Millimeters (mm)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Yarn Length Unit
              </label>
              <select
                value={unitPrefs.yarnQuantityUnit}
                onChange={(e) => setUnitPrefs({ ...unitPrefs, yarnQuantityUnit: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                <option value="yd">Yards (yd)</option>
                <option value="m">Meters (m)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Yarn Weight Unit
              </label>
              <select
                value={unitPrefs.yarnWeightUnit}
                onChange={(e) => setUnitPrefs({ ...unitPrefs, yarnWeightUnit: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                <option value="g">Grams (g)</option>
                <option value="oz">Ounces (oz)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Gauge Base
              </label>
              <select
                value={unitPrefs.gaugeBase}
                onChange={(e) => setUnitPrefs({ ...unitPrefs, gaugeBase: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                <option value="4in">Per 4 inches</option>
                <option value="10cm">Per 10 cm</option>
              </select>
            </div>
          </div>

          <div className="pt-6">
            <button
              onClick={async () => {
                setSavingUnits(true);
                try {
                  const response = await axios.put('/api/auth/profile', {
                    preferences: { measurements: unitPrefs },
                  });
                  const updatedUser = response.data.data.user;
                  setUser(updatedUser);
                  toast.success('Unit preferences saved!');
                } catch {
                  toast.error('Failed to save unit preferences');
                } finally {
                  setSavingUnits(false);
                }
              }}
              disabled={savingUnits}
              className="flex items-center gap-2 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              <FiSave className="h-4 w-4" />
              {savingUnits ? 'Saving...' : 'Save Preferences'}
            </button>
          </div>
        </div>
      )}

      {/* Integrations Tab */}
      {activeTab === 'integrations' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Ravelry</h3>

          {ravelryConnected ? (
            <div>
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
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={() => navigate('/ravelry/sync')}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
                >
                  <FiRefreshCw className="h-4 w-4" />
                  Sync patterns
                </button>
                <button
                  onClick={() => navigate('/ravelry/stash/sync')}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
                >
                  <FiRefreshCw className="h-4 w-4" />
                  Sync stash
                </button>
                <button
                  onClick={() => navigate('/ravelry/favorites')}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
                >
                  <FiHeart className="h-4 w-4" />
                  Browse favorites
                </button>
              </div>
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
