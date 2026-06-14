import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axiosInstance from '../utils/axiosInstance';
import { useToast } from '../contexts/ToastContext';
import { Users, Plus, ArrowRight, FolderPlus } from 'lucide-react';
import Spinner from '../components/common/Spinner';

const GroupsPage = () => {
  const { addToast } = useToast();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchGroups = async () => {
      try {
        setLoading(true);
        const res = await axiosInstance.get('/groups');
        if (res.data.success) {
          setGroups(res.data.groups);
        }
      } catch (err) {
        addToast('Failed to fetch groups.', 'error');
      } finally {
        setLoading(false);
      }
    };
    fetchGroups();
  }, [addToast]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[75vh]">
        <Spinner size="large" />
        <p className="mt-4 text-sm text-gray-500 dark:text-gray-400 font-medium">Fetching your groups...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Your Groups</h1>
          <p className="text-gray-500 dark:text-gray-400">View and manage shared expenses across all active rooms.</p>
        </div>
        <Link
          to="/groups/create"
          className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 shadow-sm transition-all"
        >
          <Plus className="h-4 w-4 mr-2" />
          <span>Create Group</span>
        </Link>
      </div>

      {/* Grid of Groups */}
      {groups.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {groups.map((group) => (
            <div
              key={group._id}
              className="bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-sm ring-1 ring-black/5 dark:ring-white/5 flex flex-col justify-between hover:shadow-md hover:ring-primary-500/20 transition-all duration-200"
            >
              <div>
                <div className="h-10 w-10 rounded-2xl bg-primary-50 dark:bg-primary-950/40 text-primary-500 flex items-center justify-center mb-4">
                  <Users className="h-5 w-5" />
                </div>
                <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-2">{group.name}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-450 line-clamp-2 mb-4">
                  {group.description || 'No description provided.'}
                </p>
              </div>

              <div className="border-t border-gray-55 dark:border-gray-800 pt-4 mt-2 flex items-center justify-between">
                <span className="text-xs text-gray-450 dark:text-gray-500 font-medium">
                  {group.members?.length || 0} members active
                </span>
                <Link
                  to={`/groups/${group._id}`}
                  className="inline-flex items-center text-sm font-bold text-primary-600 dark:text-primary-400 hover:text-primary-750 transition-colors"
                >
                  <span>Enter Ledger</span>
                  <ArrowRight className="h-4 w-4 ml-1.5" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-gray-900 rounded-3xl shadow-sm ring-1 ring-black/5 dark:ring-white/5 text-center px-4">
          <div className="h-16 w-16 bg-gray-50 dark:bg-gray-850 rounded-2xl flex items-center justify-center text-gray-400 mb-6">
            <FolderPlus className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-bold mb-2">No Groups Found</h2>
          <p className="text-sm text-gray-500 dark:text-gray-450 max-w-sm mb-6">
            Get started by creating a new group with your flatmates or travel friends.
          </p>
          <Link
            to="/groups/create"
            className="inline-flex items-center justify-center px-5 py-3 rounded-xl text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 shadow-sm transition-all"
          >
            <Plus className="h-4 w-4 mr-2" />
            <span>Create a Group</span>
          </Link>
        </div>
      )}
    </div>
  );
};

export default GroupsPage;
