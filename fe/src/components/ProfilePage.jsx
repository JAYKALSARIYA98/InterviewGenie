import { useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { changePassword, updateProfile } from "../auth/api";

export default function ProfilePage() {
  const { user, token, saveAuth } = useAuth();
  const [name, setName] = useState(user?.name || "");
  const [profileMessage, setProfileMessage] = useState("");
  const [profileError, setProfileError] = useState("");
  const [profileLoading, setProfileLoading] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setProfileLoading(true);
    setProfileError("");
    setProfileMessage("");
    try {
      const data = await updateProfile({ name: name.trim() }, token);
      saveAuth(
        {
          ...user,
          name: data.user.name,
        },
        token
      );
      setProfileMessage("Profile updated successfully.");
    } catch (err) {
      setProfileError(err.message);
    } finally {
      setProfileLoading(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }
    setPasswordLoading(true);
    setPasswordError("");
    setPasswordMessage("");
    try {
      await changePassword({ currentPassword, newPassword }, token);
      setPasswordMessage("Password changed successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setPasswordError(err.message);
    } finally {
      setPasswordLoading(false);
    }
  };

  const statusColor = user?.isVerified ? "bg-emerald-100 text-emerald-700" : "bg-yellow-100 text-yellow-700";
  const statusLabel = user?.isVerified ? "Email verified" : "Email not verified";

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-700 via-purple-600 to-blue-600 flex items-center justify-center p-4">
      <div className="relative max-w-3xl w-full">
        <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-400 to-blue-400 opacity-60 blur-lg" />
        <div className="relative bg-white rounded-2xl shadow-xl p-6 md:p-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">My profile</h1>
              <p className="text-gray-500 text-sm md:text-base">
                Manage your account details and keep your credentials up to date.
              </p>
            </div>
            <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs md:text-sm ${statusColor}`}>
              <span className="w-2 h-2 rounded-full bg-current mr-2" />
              {statusLabel}
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <form onSubmit={handleProfileSubmit} className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900">Profile details</h2>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                <div className="px-3 py-2 rounded-lg bg-gray-100 text-gray-700 text-sm">
                  {user?.email}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              {profileError && (
                <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded px-3 py-2">
                  {profileError}
                </div>
              )}
              {profileMessage && (
                <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded px-3 py-2">
                  {profileMessage}
                </div>
              )}
              <button
                type="submit"
                disabled={profileLoading}
                className="inline-flex items-center justify-center px-4 py-2 rounded-lg text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-60 transition-colors"
              >
                {profileLoading ? "Saving..." : "Save changes"}
              </button>
            </form>

            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900">Change password</h2>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Current password
                </label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">New password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Confirm new password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              {passwordError && (
                <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded px-3 py-2">
                  {passwordError}
                </div>
              )}
              {passwordMessage && (
                <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-100 rounded px-3 py-2">
                  {passwordMessage}
                </div>
              )}
              <button
                type="submit"
                disabled={passwordLoading}
                className="inline-flex items-center justify-center px-4 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 transition-colors"
              >
                {passwordLoading ? "Updating..." : "Update password"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

