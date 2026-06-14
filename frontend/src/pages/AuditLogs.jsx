import React, { useState, useEffect } from 'react';
import axiosInstance from '../utils/axiosInstance';
import { useToast } from '../contexts/ToastContext';
import { ShieldAlert, Calendar, User, Eye, EyeOff } from 'lucide-react';
import Spinner from '../components/common/Spinner';

const AuditLogs = () => {
  const { addToast } = useToast();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedLog, setExpandedLog] = useState(null); // stores log ID to view details

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        setLoading(true);
        const res = await axiosInstance.get('/audit');
        if (res.data.success) {
          setLogs(res.data.logs);
        }
      } catch (err) {
        addToast('Failed to retrieve audit logs.', 'error');
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, [addToast]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh]">
        <Spinner size="large" />
        <p className="text-sm text-gray-500 mt-4">Loading audit ledger logs...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-scale-up">
      {/* Title */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Audit Logs</h1>
        <p className="text-gray-500 dark:text-gray-400">
          Traceable, explaining-ready ledger of all actions performed in this workspace.
        </p>
      </div>

      {/* Logs Card */}
      <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-sm ring-1 ring-black/5 dark:ring-white/5 overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-800 flex items-center">
          <ShieldAlert className="h-5 w-5 mr-2 text-primary-500" />
          <h3 className="font-bold text-lg">System Audit Log</h3>
        </div>

        {logs.length > 0 ? (
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {logs.map((log) => {
              const isExpanded = expandedLog === log._id;
              
              let actionBadge = 'bg-gray-50 text-gray-655 dark:bg-gray-800 dark:text-gray-450';
              if (log.action === 'CREATE') actionBadge = 'bg-green-50 text-green-600 dark:bg-green-950/20 dark:text-green-400';
              if (log.action === 'DELETE') actionBadge = 'bg-red-50 text-red-600 dark:bg-red-950/20 dark:text-red-400';
              if (log.action === 'UPDATE') actionBadge = 'bg-amber-50 text-amber-600 dark:bg-amber-950/20 dark:text-amber-400';

              return (
                <div key={log._id} className="p-6 space-y-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-center space-x-3 text-xs">
                      <span className={`inline-block px-2.5 py-1 rounded-full font-bold uppercase tracking-wider text-[10px] ${actionBadge}`}>
                        {log.action}
                      </span>
                      <span className="font-bold uppercase tracking-wider text-[10px] text-gray-400">
                        {log.entityType}
                      </span>
                      <span className="font-mono text-gray-450 dark:text-gray-500 truncate max-w-[150px]">
                        ID: {log.entityId}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 dark:text-gray-450">
                      <div className="flex items-center space-x-1">
                        <User className="h-4 w-4 text-gray-400" />
                        <span className="font-medium">{log.performedBy?.name || 'System'}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Calendar className="h-4 w-4 text-gray-400" />
                        <span>{new Date(log.createdAt).toLocaleString()}</span>
                      </div>
                      <button
                        onClick={() => setExpandedLog(isExpanded ? null : log._id)}
                        className="inline-flex items-center text-primary-600 dark:text-primary-400 hover:underline font-semibold"
                      >
                        {isExpanded ? (
                          <>
                            <EyeOff className="h-4 w-4 mr-1" />
                            <span>Hide Diff</span>
                          </>
                        ) : (
                          <>
                            <Eye className="h-4 w-4 mr-1" />
                            <span>Show Diff</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Expanded JSON diff */}
                  {isExpanded && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-gray-50 dark:border-gray-850 animate-slide-in">
                      <div>
                        <span className="block text-[10px] uppercase font-bold text-gray-450 mb-2">Previous State (Old Value)</span>
                        <pre className="p-4 bg-gray-50 dark:bg-gray-950 rounded-2xl text-[10px] font-mono overflow-auto max-h-48 border border-gray-150 dark:border-gray-850">
                          {log.oldValue ? JSON.stringify(log.oldValue, null, 2) : 'NULL'}
                        </pre>
                      </div>
                      <div>
                        <span className="block text-[10px] uppercase font-bold text-gray-450 mb-2">New State (New Value)</span>
                        <pre className="p-4 bg-gray-50 dark:bg-gray-950 rounded-2xl text-[10px] font-mono overflow-auto max-h-48 border border-gray-150 dark:border-gray-850">
                          {log.newValue ? JSON.stringify(log.newValue, null, 2) : 'NULL'}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-sm text-gray-400">No actions logged yet in the audit register.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuditLogs;
