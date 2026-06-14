import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Settings as SettingsIcon, ShieldCheck, KeyRound } from 'lucide-react';
import Spinner from '../components/common/Spinner';

const Settings = () => {
  const { user, changePassword } = useAuth();
  const { addToast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm({
    defaultValues: {
      oldPassword: '',
      newPassword: '',
      confirmPassword: ''
    }
  });

  const onSubmit = async (data) => {
    setSubmitting(true);
    const res = await changePassword(data.oldPassword, data.newPassword);
    setSubmitting(false);

    if (res.success) {
      addToast('Password updated successfully!', 'success');
      reset();
    } else {
      addToast(res.error, 'error');
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-scale-up">
      {/* Title */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-gray-500 dark:text-gray-400">Manage your profile metadata and change security credentials.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Profile Details Column */}
        <div className="md:col-span-1 bg-white dark:bg-gray-900 p-6 rounded-3xl shadow-sm ring-1 ring-black/5 dark:ring-white/5 space-y-4">
          <h3 className="font-bold text-md flex items-center border-b border-gray-150 dark:border-gray-800 pb-3">
            <ShieldCheck className="h-5 w-5 mr-2 text-primary-500" />
            <span>Security Profile</span>
          </h3>
          
          <div className="flex flex-col items-center py-4 space-y-3">
            <img
              src={user?.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${user?.name}`}
              alt={user?.name}
              className="h-20 w-20 rounded-full border-2 border-primary-200 dark:border-gray-800 shadow-sm"
            />
            <div className="text-center">
              <h4 className="font-bold text-sm">{user?.name}</h4>
              <p className="text-xs text-gray-400">{user?.email}</p>
            </div>
          </div>

          <div className="space-y-3 text-xs text-gray-500 dark:text-gray-400">
            <div className="flex justify-between">
              <span>Account Authority:</span>
              <span className="font-semibold text-gray-850 dark:text-gray-200">Registered</span>
            </div>
            <div className="flex justify-between">
              <span>Workspace Access:</span>
              <span className="font-semibold text-green-500">Active</span>
            </div>
          </div>
        </div>

        {/* Change password column */}
        <div className="md:col-span-2 bg-white dark:bg-gray-900 p-8 rounded-3xl shadow-sm ring-1 ring-black/5 dark:ring-white/5">
          <h3 className="font-bold text-md flex items-center border-b border-gray-150 dark:border-gray-800 pb-4 mb-6">
            <KeyRound className="h-5 w-5 mr-2 text-primary-500" />
            <span>Update Password</span>
          </h3>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            
            {/* Old password */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Current Password *
              </label>
              <input
                type="password"
                className={`block w-full px-4 py-3 rounded-xl border ${
                  errors.oldPassword 
                    ? 'border-red-500 ring-red-150' 
                    : 'border-gray-300 dark:border-gray-700'
                } bg-white dark:bg-gray-950 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm transition-all`}
                {...register('oldPassword', { required: 'Current password is required' })}
              />
              {errors.oldPassword && (
                <span className="text-red-500 text-xs mt-1 block">{errors.oldPassword.message}</span>
              )}
            </div>

            {/* New password */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                New Password *
              </label>
              <input
                type="password"
                className={`block w-full px-4 py-3 rounded-xl border ${
                  errors.newPassword 
                    ? 'border-red-500 ring-red-150' 
                    : 'border-gray-300 dark:border-gray-700'
                } bg-white dark:bg-gray-950 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm transition-all`}
                {...register('newPassword', { 
                  required: 'New password is required',
                  minLength: {
                    value: 6,
                    message: 'Password must be at least 6 characters'
                  }
                })}
              />
              {errors.newPassword && (
                <span className="text-red-500 text-xs mt-1 block">{errors.newPassword.message}</span>
              )}
            </div>

            {/* Confirm password */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Confirm New Password *
              </label>
              <input
                type="password"
                className={`block w-full px-4 py-3 rounded-xl border ${
                  errors.confirmPassword 
                    ? 'border-red-500 ring-red-150' 
                    : 'border-gray-300 dark:border-gray-700'
                } bg-white dark:bg-gray-950 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm transition-all`}
                {...register('confirmPassword', { 
                  required: 'Please confirm your new password',
                  validate: (value) => value === watch('newPassword') || 'Passwords do not match'
                })}
              />
              {errors.confirmPassword && (
                <span className="text-red-500 text-xs mt-1 block">{errors.confirmPassword.message}</span>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center px-5 py-3 rounded-xl text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {submitting && <Spinner size="small" className="mr-2" />}
              <span>Save Security Settings</span>
            </button>

          </form>
        </div>
      </div>
    </div>
  );
};

export default Settings;
