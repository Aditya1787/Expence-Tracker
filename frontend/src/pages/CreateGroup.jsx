import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import axiosInstance from '../utils/axiosInstance';
import { useToast } from '../contexts/ToastContext';
import { Plus, Trash, FolderPlus, ArrowLeft } from 'lucide-react';
import Spinner from '../components/common/Spinner';

const CreateGroup = () => {
  const { addToast } = useToast();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  const { register, control, handleSubmit, formState: { errors } } = useForm({
    defaultValues: {
      name: '',
      description: '',
      memberEmails: [{ email: '' }]
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'memberEmails'
  });

  const onSubmit = async (data) => {
    setSubmitting(true);
    try {
      const payload = {
        name: data.name,
        description: data.description,
        memberEmails: data.memberEmails.map(item => item.email).filter(Boolean)
      };

      const res = await axiosInstance.post('/groups', payload);
      if (res.data.success) {
        addToast(`Group "${res.data.group.name}" created successfully!`, 'success');
        navigate(`/groups/${res.data.group._id}`);
      }
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to create group', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Back button */}
      <div>
        <Link to="/groups" className="inline-flex items-center text-sm font-semibold text-gray-500 dark:text-gray-400 hover:text-primary-550 transition-colors">
          <ArrowLeft className="h-4 w-4 mr-2" />
          <span>Back to Groups</span>
        </Link>
      </div>

      {/* Main card */}
      <div className="bg-white dark:bg-gray-900 rounded-3xl p-8 shadow-sm ring-1 ring-black/5 dark:ring-white/5">
        <div className="flex items-center space-x-3.5 mb-6 border-b border-gray-100 dark:border-gray-800 pb-5">
          <div className="p-3 bg-primary-50 dark:bg-primary-950/40 text-primary-500 rounded-2xl">
            <FolderPlus className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Create a New Group</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">Assemble flatmates or friends to keep track of shared ledger expenses.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Group Name */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
              Group Name *
            </label>
            <input
              type="text"
              placeholder="e.g. 504 Flatmates, Summer Trip 2026"
              className={`block w-full px-4 py-3 rounded-xl border ${
                errors.name 
                  ? 'border-red-500 ring-red-150' 
                  : 'border-gray-300 dark:border-gray-700'
              } bg-white dark:bg-gray-950 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm transition-all`}
              {...register('name', { required: 'Group name is required' })}
            />
            {errors.name && (
              <span className="text-red-500 text-xs mt-1 block">{errors.name.message}</span>
            )}
          </div>

          {/* Group Description */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
              Description
            </label>
            <textarea
              rows={3}
              placeholder="Optional notes or context about this group..."
              className="block w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm transition-all"
              {...register('description')}
            />
          </div>

          {/* Members emails array */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                Invite Members by Email
              </label>
              <button
                type="button"
                onClick={() => append({ email: '' })}
                className="inline-flex items-center text-xs font-bold text-primary-600 dark:text-primary-400 hover:text-primary-550"
              >
                <Plus className="h-4 w-4 mr-1" />
                <span>Add Member</span>
              </button>
            </div>

            <p className="text-xs text-gray-400">
              Only users registered on SplitLedge can be added. You can also add/remove members later.
            </p>

            <div className="space-y-3">
              {fields.map((field, index) => (
                <div key={field.id} className="flex items-center space-x-3">
                  <input
                    type="email"
                    placeholder="friend@example.com"
                    className="flex-1 block w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm transition-all"
                    {...register(`memberEmails.${index}.email`, {
                      pattern: {
                        value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                        message: 'Invalid email format'
                      }
                    })}
                  />
                  {fields.length > 1 && (
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      className="p-2.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/25 rounded-xl transition-all"
                    >
                      <Trash className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Submit buttons */}
          <div className="flex justify-end space-x-3 border-t border-gray-100 dark:border-gray-800 pt-5">
            <Link
              to="/groups"
              className="px-5 py-3 rounded-xl border border-gray-200 dark:border-gray-800 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-850 transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center px-6 py-3 rounded-xl text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {submitting && <Spinner size="small" className="mr-2" />}
              <span>Create Group</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateGroup;
