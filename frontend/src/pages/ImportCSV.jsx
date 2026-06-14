import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axiosInstance from '../utils/axiosInstance';
import { useToast } from '../contexts/ToastContext';
import { 
  FileSpreadsheet, 
  Upload, 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  RefreshCw, 
  UserCheck, 
  HelpCircle,
  ArrowRight
} from 'lucide-react';
import Spinner from '../components/common/Spinner';

const ImportCSV = () => {
  const { addToast } = useToast();
  
  // State
  const [groups, setGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [file, setFile] = useState(null);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [uploading, setUploading] = useState(false);
  
  // Validation Report State
  const [report, setReport] = useState(null);
  const [groupUsers, setGroupUsers] = useState([]); // Users of the selected group to map to
  const [userMappings, setUserMappings] = useState({}); // { 'priya s': 'priya_user_id', 'priya': 'priya_user_id' }
  const [rowFinalActions, setRowFinalActions] = useState({}); // { rowNumber: 'IMPORT' or 'SKIP' }
  const [finalizing, setFinalizing] = useState(false);

  useEffect(() => {
    const fetchGroups = async () => {
      try {
        const res = await axiosInstance.get('/groups');
        if (res.data.success) {
          setGroups(res.data.groups);
          const queryGroupId = new URLSearchParams(window.location.search).get('groupId');
          if (res.data.groups.length > 0) {
            const matched = res.data.groups.find(g => g._id === queryGroupId);
            setSelectedGroupId(matched ? queryGroupId : res.data.groups[0]._id);
          }
        }
      } catch (err) {
        addToast('Failed to load groups for importing context', 'error');
      } finally {
        setLoadingGroups(false);
      }
    };
    fetchGroups();
  }, [addToast]);

  // Handle group selection change and reset report states to avoid cross-group leakage
  const handleGroupChange = (e) => {
    const nextGroupId = e.target.value;
    setSelectedGroupId(nextGroupId);
    setReport(null);
    setFile(null);
    setUserMappings({});
    setRowFinalActions({});
  };

  // Load group users when selectedGroup changes
  useEffect(() => {
    if (!selectedGroupId) return;
    const selectedGroup = groups.find(g => g._id === selectedGroupId);
    if (selectedGroup && selectedGroup.members) {
      setGroupUsers(selectedGroup.members.map(m => m.user));
    }
  }, [selectedGroupId, groups]);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!selectedGroupId) {
      addToast('Please select a group first', 'error');
      return;
    }
    if (!file) {
      addToast('Please select a CSV file to import', 'error');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('groupId', selectedGroupId);

    try {
      setUploading(true);
      setReport(null);
      const res = await axiosInstance.post('/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      if (res.data.success) {
        setReport(res.data.report);
        addToast('CSV file parsed and analyzed successfully!', 'success');
        
        // Initialize user mappings with auto-detected matches
        const mappings = {};
        const actions = {};

        res.data.report.rows.forEach(row => {
          actions[row.rowNumber] = row.status === 'ERROR' ? 'SKIP' : 'IMPORT';
          
          // Pre-populate user mappings based on system resolution
          if (row.parsedData) {
            const { paidByRaw, paidByUserId, participantsRaw, participantsResolved } = row.parsedData;
            
            if (paidByRaw && paidByUserId) {
              mappings[paidByRaw.trim().toLowerCase()] = paidByUserId;
            }
            // Add other participants who were resolved
            if (row.rawRow.split_with) {
              const rawNames = row.rawRow.split_with.split(';');
              rawNames.forEach(name => {
                const clean = name.trim();
                const matchedUser = groupUsers.find(u => u.name.trim().toLowerCase() === clean.toLowerCase());
                if (matchedUser) {
                  mappings[clean.toLowerCase()] = matchedUser._id;
                }
              });
            }
          }
        });
        
        setUserMappings(mappings);
        setRowFinalActions(actions);
      }
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to analyze CSV file', 'error');
    } finally {
      setUploading(false);
    }
  };

  // Map raw CSV names to database IDs
  const handleMapUser = (rawName, userId) => {
    setUserMappings(prev => ({
      ...prev,
      [rawName.trim().toLowerCase()]: userId
    }));
  };

  const handleActionToggle = (rowNumber) => {
    setRowFinalActions(prev => ({
      ...prev,
      [rowNumber]: prev[rowNumber] === 'IMPORT' ? 'SKIP' : 'IMPORT'
    }));
  };

  // Finalize Save Import
  const handleFinalize = async () => {
    setFinalizing(true);
    try {
      // Build the resolved rows by patching user mappings
      const resolvedRows = report.rows.map(row => {
        const action = rowFinalActions[row.rowNumber];
        
        // Copy parsedData to avoid mutating state directly
        const parsedData = { ...row.parsedData };

        if (action === 'IMPORT' && row.status !== 'ERROR') {
          // 1. Resolve PaidBy
          if (parsedData.paidByRaw) {
            const key = parsedData.paidByRaw.trim().toLowerCase();
            if (userMappings[key]) {
              parsedData.paidByUserId = userMappings[key];
            }
          }

          // 2. Resolve Participants
          if (parsedData.participantsRaw && parsedData.participantsRaw.length > 0) {
            parsedData.participantsResolved = parsedData.participantsRaw.map(rawName => {
              const key = rawName.trim().toLowerCase();
              return userMappings[key] || null;
            }).filter(Boolean);
          }
        }

        return {
          rowNumber: row.rowNumber,
          status: row.status,
          action: action, // 'IMPORT' or 'SKIP'
          parsedData
        };
      });

      const res = await axiosInstance.post('/import/finalize', {
        groupId: selectedGroupId,
        tempFilePath: report.tempFilePath,
        resolvedRows
      });

      if (res.data.success) {
        addToast(`Successfully imported: ${res.data.result.importedCount.expenses} Expenses, ${res.data.result.importedCount.settlements} Settlements!`, 'success');
        setReport(null);
        setFile(null);
      }
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to finalize import', 'error');
    } finally {
      setFinalizing(false);
    }
  };

  if (loadingGroups) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh]">
        <Spinner size="large" />
        <p className="text-sm text-gray-500 mt-4">Loading groups...</p>
      </div>
    );
  }

  // Find all unique raw user names that need mapping
  const getUnmappedUsers = () => {
    if (!report) return [];
    const names = new Set();
    report.rows.forEach(row => {
      if (row.status === 'ERROR') return;
      const parsed = row.parsedData;
      if (parsed) {
        if (parsed.paidByRaw && !userMappings[parsed.paidByRaw.trim().toLowerCase()]) {
          names.add(parsed.paidByRaw.trim());
        }
        if (parsed.participantsRaw) {
          parsed.participantsRaw.forEach(n => {
            if (!userMappings[n.trim().toLowerCase()]) {
              names.add(n.trim());
            }
          });
        }
      }
    });
    return Array.from(names);
  };

  const unmappedUsers = getUnmappedUsers();

  return (
    <div className="space-y-8">
      {/* Title */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">CSV Import System</h1>
        <p className="text-gray-500 dark:text-gray-400">
          Upload room statement exports. Our engine flags conflicts, timeline outliers, and duplicate entries.
        </p>
      </div>

      {!report ? (
        groups.length === 0 ? (
          <div className="max-w-xl mx-auto text-center bg-white dark:bg-gray-900 p-8 rounded-3xl shadow-sm ring-1 ring-black/5 dark:ring-white/5 space-y-6">
            <div className="mx-auto h-12 w-12 bg-amber-50 dark:bg-amber-950/20 text-amber-500 rounded-2xl flex items-center justify-center animate-pulse">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div className="space-y-2">
              <h2 className="text-lg font-bold">No Groups Found</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                You are not currently a member of any group. To import a statement, you must first belong to at least one group.
              </p>
            </div>
            <div className="p-4 bg-primary-50/50 dark:bg-primary-950/10 rounded-2xl border border-primary-100/30 text-left space-y-2.5">
              <span className="text-[11px] font-bold text-primary-600 dark:text-primary-400 uppercase tracking-wider block">Testing tip:</span>
              <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                If you created a new account, you won't have any groups yet. Try logging out and logging in as one of our seed test users to inspect preloaded group ledgers:
              </p>
              <div className="text-[11px] font-mono bg-white dark:bg-gray-950 p-2.5 rounded-xl border border-gray-100 dark:border-gray-850 space-y-1 text-gray-750 dark:text-gray-300">
                <p>Email: <span className="font-semibold text-primary-500">aisha@example.com</span> (or rohan@example.com, priya@example.com)</p>
                <p>Password: <span className="font-semibold text-primary-500">password123</span></p>
              </div>
            </div>
            <Link
              to="/groups/create"
              className="w-full inline-flex items-center justify-center py-3.5 px-4 rounded-xl text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 shadow-sm transition-all"
            >
              Create a Group
            </Link>
          </div>
        ) : (
          // Upload Form
          <div className="max-w-xl mx-auto bg-white dark:bg-gray-900 p-8 rounded-3xl shadow-sm ring-1 ring-black/5 dark:ring-white/5">
            <form onSubmit={handleUpload} className="space-y-6">
            
            {/* Target Group */}
            <div>
              <label className="block text-sm font-semibold text-gray-750 dark:text-gray-300 mb-1.5">
                Target Import Group *
              </label>
              <select
                value={selectedGroupId}
                onChange={handleGroupChange}
                className="block w-full px-4 py-3.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm font-medium transition-all"
                required
              >
                <option value="" disabled>-- Select target group --</option>
                {groups.map((g) => (
                  <option key={g._id} value={g._id}>
                    {g.name} ({g.members?.length || 0} members)
                  </option>
                ))}
              </select>
            </div>

            {/* File dropzone */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                Statement File (.csv) *
              </label>
              <div className="mt-1 flex justify-center px-6 pt-10 pb-12 border-2 border-dashed border-gray-300 dark:border-gray-700 hover:border-primary-500 dark:hover:border-primary-500 rounded-2xl cursor-pointer relative transition-colors">
                <div className="space-y-2 text-center">
                  <div className="mx-auto h-12 w-12 text-gray-400 bg-gray-50 dark:bg-gray-850 rounded-xl flex items-center justify-center">
                    <FileSpreadsheet className="h-6 w-6 text-primary-500" />
                  </div>
                  <div className="flex text-sm text-gray-655 dark:text-gray-400">
                    <label className="relative cursor-pointer rounded-md font-semibold text-primary-600 dark:text-primary-400 hover:text-primary-500">
                      <span>Upload a file</span>
                      <input
                        type="file"
                        accept=".csv"
                        onChange={handleFileChange}
                        className="sr-only"
                      />
                    </label>
                    <p className="pl-1">or drag and drop</p>
                  </div>
                  <p className="text-xs text-gray-400">
                    {file ? `Selected: ${file.name}` : 'CSV files up to 5MB'}
                  </p>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={uploading || !file}
              className="w-full inline-flex items-center justify-center py-3.5 px-4 border border-transparent text-sm font-semibold rounded-xl text-white bg-primary-600 hover:bg-primary-700 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {uploading ? (
                <>
                  <Spinner size="small" className="mr-2" />
                  <span>Analyzing CSV Records...</span>
                </>
              ) : (
                <>
                  <Upload className="h-5 w-5 mr-2" />
                  <span>Analyze Statement</span>
                </>
              )}
            </button>

          </form>
        </div>
      )
      ) : (
        // Validation Dashboard Report
        <div className="space-y-8 animate-scale-up">
          
          {/* Back button */}
          <button
            onClick={() => setReport(null)}
            className="inline-flex items-center text-sm font-semibold text-gray-500 dark:text-gray-400 hover:text-primary-550"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            <span>Upload Another File</span>
          </button>

          {/* Metrics summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl shadow-sm ring-1 ring-black/5 dark:ring-white/5 flex items-center space-x-4">
              <div className="p-3 bg-gray-50 dark:bg-gray-800 text-gray-500 rounded-2xl">
                <FileSpreadsheet className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total Rows</p>
                <h4 className="text-2xl font-extrabold">{report.totalRows}</h4>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl shadow-sm ring-1 ring-black/5 dark:ring-white/5 flex items-center space-x-4">
              <div className="p-3 bg-amber-50 dark:bg-amber-950/20 text-amber-500 rounded-2xl">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Warnings Flagged</p>
                <h4 className="text-2xl font-extrabold text-amber-500">{report.warningsCount}</h4>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl shadow-sm ring-1 ring-black/5 dark:ring-white/5 flex items-center space-x-4">
              <div className="p-3 bg-red-50 dark:bg-red-950/20 text-red-505 rounded-2xl">
                <XCircle className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Errors Flagged</p>
                <h4 className="text-2xl font-extrabold text-red-500">{report.errorsCount}</h4>
              </div>
            </div>
          </div>

          {/* User mappings dashboard */}
          {unmappedUsers.length > 0 && (
            <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl shadow-sm ring-1 ring-black/5 dark:ring-white/5 space-y-4">
              <h3 className="text-md font-bold flex items-center text-primary-655 dark:text-primary-400">
                <UserCheck className="h-5 w-5 mr-2" />
                <span>Resolve Unknown Users mappings ({unmappedUsers.length})</span>
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Map statement names to registered group members. Unmapped participants will be excluded from split calculations.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-2">
                {unmappedUsers.map((rawName) => (
                  <div key={rawName} className="p-3.5 rounded-2xl border border-gray-150 dark:border-gray-800/80 bg-gray-50/50 dark:bg-gray-950/30 flex items-center justify-between">
                    <span className="text-xs font-mono font-semibold truncate pr-2">{rawName}</span>
                    <select
                      value={userMappings[rawName.toLowerCase()] || ''}
                      onChange={(e) => handleMapUser(rawName, e.target.value)}
                      className="px-2.5 py-1.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 text-xs focus:ring-1 focus:ring-primary-500"
                    >
                      <option value="">Exile/Select...</option>
                      {groupUsers.map(u => (
                        <option key={u._id} value={u._id}>{u.name}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Rows Analysis Feed */}
          <div className="bg-white dark:bg-gray-900 rounded-3xl shadow-sm ring-1 ring-black/5 dark:ring-white/5 overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-800">
              <h3 className="font-bold text-lg">Transaction List Analysis</h3>
            </div>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100 dark:divide-gray-800">
                <thead className="bg-gray-50 dark:bg-gray-850">
                  <tr className="text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    <th className="px-6 py-3">Row</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Description</th>
                    <th className="px-6 py-3">Paid By</th>
                    <th className="px-6 py-3">Amount</th>
                    <th className="px-6 py-3">Anomalies Detected</th>
                    <th className="px-6 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-xs">
                  {report.rows.map((row) => {
                    const isImport = rowFinalActions[row.rowNumber] === 'IMPORT';
                    
                    let statusColor = 'text-green-500 bg-green-50 dark:bg-green-950/20';
                    let statusIcon = <CheckCircle className="h-4 w-4 shrink-0" />;
                    if (row.status === 'WARNING') {
                      statusColor = 'text-amber-500 bg-amber-50 dark:bg-amber-950/20';
                      statusIcon = <AlertTriangle className="h-4 w-4 shrink-0" />;
                    } else if (row.status === 'ERROR') {
                      statusColor = 'text-red-500 bg-red-50 dark:bg-red-950/20';
                      statusIcon = <XCircle className="h-4 w-4 shrink-0" />;
                    }

                    return (
                      <tr key={row.rowNumber} className={row.status === 'ERROR' ? 'bg-red-50/5 dark:bg-red-950/5' : ''}>
                        <td className="px-6 py-4 font-mono">{row.rowNumber}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-full font-semibold ${statusColor}`}>
                            {statusIcon}
                            <span>{row.status}</span>
                          </span>
                        </td>
                        <td className="px-6 py-4 font-medium max-w-xs truncate">{row.rawRow.description}</td>
                        <td className="px-6 py-4 font-mono">{row.rawRow.paid_by || <span className="text-red-500">None</span>}</td>
                        <td className="px-6 py-4 font-bold">{row.rawRow.amount} {row.rawRow.currency || 'INR'}</td>
                        <td className="px-6 py-4">
                          {row.anomalies.length > 0 ? (
                            <div className="space-y-1.5">
                              {row.anomalies.map((a, index) => (
                                <div key={index} className="flex items-start text-[10px] text-gray-500 leading-normal">
                                  <span className="font-semibold text-amber-600 dark:text-amber-450 mr-1 shrink-0">[{a.issueType}]:</span>
                                  <span>{a.description} ({a.actionTaken})</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-gray-400">None - clean</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          {row.status === 'ERROR' ? (
                            <span className="text-red-500 font-bold uppercase tracking-wider text-[9px] bg-red-50 dark:bg-red-950/30 px-2.5 py-1 rounded-md">Rejected</span>
                          ) : (
                            <button
                              onClick={() => handleActionToggle(row.rowNumber)}
                              className={`px-3 py-1.5 rounded-xl font-bold transition-all text-[11px] ${
                                isImport
                                  ? 'bg-primary-50 text-primary-600 dark:bg-primary-950/40 dark:text-primary-400'
                                  : 'bg-gray-100 dark:bg-gray-800 text-gray-450 hover:text-gray-650'
                              }`}
                            >
                              {isImport ? 'Will Import' : 'Will Skip'}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Finalize button */}
          <div className="flex justify-end pt-4">
            <button
              onClick={handleFinalize}
              disabled={finalizing || report.rows.every(r => rowFinalActions[r.rowNumber] === 'SKIP')}
              className="inline-flex items-center px-6 py-3.5 rounded-xl text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {finalizing ? (
                <>
                  <Spinner size="small" className="mr-2" />
                  <span>Finalizing and committing entries...</span>
                </>
              ) : (
                <>
                  <span>Commit Mappings & Import</span>
                  <ArrowRight className="h-5 w-5 ml-2" />
                </>
              )}
            </button>
          </div>

        </div>
      )}
    </div>
  );
};

export default ImportCSV;
