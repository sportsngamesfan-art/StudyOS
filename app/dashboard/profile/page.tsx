'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { User } from '@supabase/supabase-js'

export default function ProfilePage() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')
  const [updatingPassword, setUpdatingPassword] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [accountCreatedDate, setAccountCreatedDate] = useState('')
  const [lastLogin, setLastLogin] = useState('')

  useEffect(() => {
    const loadUserData = async () => {
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser()

      if (!currentUser) {
        router.push('/auth')
        return
      }

      setUser(currentUser)

      // Get account creation date
      if (currentUser.created_at) {
        const date = new Date(currentUser.created_at)
        setAccountCreatedDate(date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }))
      }

      // Get last login
      if (currentUser.last_sign_in_at) {
        const date = new Date(currentUser.last_sign_in_at)
        setLastLogin(date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }))
      }

      setLoading(false)
    }

    loadUserData()
  }, [router])

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordError('')
    setPasswordSuccess('')

    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match')
      return
    }

    if (newPassword.length < 8) {
      setPasswordError('Password must be at least 8 characters')
      return
    }

    setUpdatingPassword(true)

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (error) throw error

      setPasswordSuccess('Password updated successfully!')
      setNewPassword('')
      setConfirmPassword('')
      setShowPasswordForm(false)
      setTimeout(() => setPasswordSuccess(''), 5000)
    } catch (err) {
      console.error('Password update error:', err)
      setPasswordError(
        err instanceof Error ? err.message : 'Failed to update password'
      )
    } finally {
      setUpdatingPassword(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (!deleteConfirm) {
      setDeleteConfirm(true)
      return
    }

    setDeleting(true)

    try {
      const res = await fetch('/api/account/delete', { method: 'POST' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || 'Failed to delete account')

      await supabase.auth.signOut()
      router.push('/auth?deleted=1')
      router.refresh()
    } catch (err) {
      console.error('Account deletion error:', err)
      alert(err instanceof Error ? err.message : 'Failed to delete account.')
    } finally {
      setDeleting(false)
    }
  }

  const handleLogoutAllDevices = async () => {
    if (confirm('Are you sure? You will be logged out on all devices.')) {
      try {
        await supabase.auth.signOut({ scope: 'global' })
        router.push('/auth')
      } catch (err) {
        console.error('Logout error:', err)
        alert('Failed to logout. Please try again.')
      }
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-3xl font-bold text-ink">Profile &amp; Account</h1>
        <p className="text-muted mt-1">Manage your account settings</p>
      </div>

      {/* Account Info Card */}
      <div className="bg-surface rounded-xl p-6 shadow-sm border border-line transition-theme">
        <h2 className="text-xl font-semibold text-ink mb-4">Account Information</h2>

        <div className="space-y-4">
          {/* Email */}
          <div className="pb-4 border-b border-line">
            <p className="text-sm text-muted mb-1">Email Address</p>
            <p className="text-lg font-medium text-ink">{user.email}</p>
            <div className="mt-2 inline-block px-3 py-1 bg-success/10 text-success rounded-full text-xs font-semibold">
              ✓ Verified
            </div>
          </div>

          {/* Account Created */}
          <div className="pb-4 border-b border-line">
            <p className="text-sm text-muted mb-1">Account Created</p>
            <p className="text-lg font-medium text-ink">{accountCreatedDate}</p>
          </div>

          {/* Last Login */}
          <div>
            <p className="text-sm text-muted mb-1">Last Login</p>
            <p className="text-lg font-medium text-ink">
              {lastLogin || 'Just now'}
            </p>
          </div>
        </div>
      </div>

      {/* Change Password Section */}
      <div className="bg-surface rounded-xl p-6 shadow-sm border border-line transition-theme">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-ink">Security</h2>
          {passwordSuccess && (
            <div className="text-sm text-success font-medium">✓ {passwordSuccess}</div>
          )}
        </div>

        {!showPasswordForm ? (
          <button
            onClick={() => setShowPasswordForm(true)}
            className="w-full bg-primary text-white py-2 rounded-lg font-semibold hover:bg-primary-hover transition-theme"
          >
            Change Password
          </button>
        ) : (
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-ink mb-1">
                New Password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-2 bg-background border border-line text-ink rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="At least 8 characters"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-ink mb-1">
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-2 bg-background border border-line text-ink rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Confirm password"
                required
              />
            </div>

            {passwordError && (
              <div className="p-3 bg-error/10 border border-error/30 text-error rounded-lg text-sm">
                {passwordError}
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={updatingPassword}
                className="flex-1 bg-primary text-white py-2 rounded-lg font-semibold hover:bg-primary-hover transition-theme disabled:opacity-50"
              >
                {updatingPassword ? 'Updating...' : 'Update Password'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowPasswordForm(false)
                  setNewPassword('')
                  setConfirmPassword('')
                  setPasswordError('')
                }}
                className="flex-1 bg-transparent border border-line text-ink py-2 rounded-lg font-semibold hover:bg-surface-hover transition-theme"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Session Management */}
      <div className="bg-surface rounded-xl p-6 shadow-sm border border-line transition-theme">
        <h2 className="text-xl font-semibold text-ink mb-4">Session Management</h2>

        <button
          onClick={handleLogoutAllDevices}
          className="w-full bg-warning text-white py-2 rounded-lg font-semibold hover:opacity-90 transition-theme"
        >
          Logout from All Devices
        </button>
        <p className="text-xs text-muted mt-2">
          Sign out on all devices where you&apos;re logged in
        </p>
      </div>

      {/* Danger Zone */}
      <div className="bg-error/5 border border-error/30 rounded-xl p-6">
        <h2 className="text-xl font-semibold text-error mb-4">Danger Zone</h2>

        {!deleteConfirm ? (
          <button
            onClick={handleDeleteAccount}
            className="w-full bg-error text-white py-2 rounded-lg font-semibold hover:opacity-90 transition-theme"
          >
            Delete Account
          </button>
        ) : (
          <div className="space-y-4">
            <div className="bg-error/10 border border-error/40 text-error p-4 rounded-lg">
              <p className="font-semibold mb-2">⚠️ This action cannot be undone!</p>
              <p className="text-sm">
                Deleting your account will permanently remove all your data including:
              </p>
              <ul className="text-sm mt-2 space-y-1 ml-4">
                <li>• All documents and study materials</li>
                <li>• Your timetable and assignments</li>
                <li>• Study plans and preferences</li>
              </ul>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleDeleteAccount}
                disabled={deleting}
                className="flex-1 bg-error text-white py-2 rounded-lg font-semibold hover:opacity-90 transition-theme disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Yes, Delete My Account'}
              </button>
              <button
                onClick={() => setDeleteConfirm(false)}
                className="flex-1 bg-transparent border border-line text-ink py-2 rounded-lg font-semibold hover:bg-surface-hover transition-theme"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="bg-primary-light border border-primary/20 rounded-lg p-4">
        <p className="text-sm text-ink">
          💡 Need help? Contact our support team at support@studyos.app
        </p>
      </div>
    </div>
  )
}
