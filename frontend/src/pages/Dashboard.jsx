import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axiosInstance from '../utils/axiosInstance';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { 
  TrendingUp, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Users, 
  Plus, 
  Receipt,
  ArrowRight,
  ChevronRight
} from 'lucide-react';
import Spinner from '../components/common/Spinner';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Cell,
  CartesianGrid,
  ReferenceLine
} from 'recharts';

const Dashboard = () => {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalOwed: 0, totalReceivable: 0, netBalance: 0, groups: [] });
  const [recentExpenses, setRecentExpenses] = useState([]);
  const [groups, setGroups] = useState([]);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        // Get user balances across all groups
        const balanceRes = await axiosInstance.get(`/balances/user/${user._id}`);
        if (balanceRes.data.success) {
          setStats(balanceRes.data);
        }

        // Get groups
        const groupsRes = await axiosInstance.get('/groups');
        if (groupsRes.data.success) {
          setGroups(groupsRes.data.groups);
        }

        // Get recent global expenses
        const expensesRes = await axiosInstance.get('/expenses?limit=5');
        if (expensesRes.data.success) {
          setRecentExpenses(expensesRes.data.expenses);
        }
      } catch (err) {
        console.error('Error fetching dashboard statistics:', err);
        addToast('Failed to load dashboard insights.', 'error');
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchDashboardData();
    }
  }, [user, addToast]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[75vh]">
        <Spinner size="large" />
        <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">Loading your financial dashboard...</p>
      </div>
    );
  }

  // Prepping chart data
  const chartData = stats.groups.map(g => ({
    name: g.groupName.length > 12 ? g.groupName.substring(0, 10) + '...' : g.groupName,
    groupName: g.groupName,
    Balance: g.balance
  }));

  // Premium Custom Tooltip Component
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const isPositive = data.Balance >= 0;
      return (
        <div className="bg-gray-950/90 dark:bg-gray-900/95 p-3.5 rounded-2xl border border-gray-800 shadow-2xl backdrop-blur-md">
          <p className="text-[10px] uppercase font-bold text-gray-500 mb-1">{data.groupName}</p>
          <p className={`text-sm font-extrabold ${isPositive ? 'text-secondary-400' : 'text-red-405'}`}>
            {isPositive ? 'You are Owed' : 'You Owe'}: ₹{Math.abs(data.Balance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-gray-500 dark:text-gray-400">Welcome back, {user?.name}. Here is your shared ledger summary.</p>
        </div>
        <Link
          to="/groups"
          className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 shadow-sm transition-all"
        >
          <Plus className="h-4 w-4 mr-2" />
          <span>Create New Group</span>
        </Link>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Net Balance Card */}
        <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl shadow-sm ring-1 ring-black/5 dark:ring-white/5 relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div className="space-y-2">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Net Balance</span>
              <h3 className={`text-3xl font-extrabold ${stats.netBalance >= 0 ? 'text-secondary-655' : 'text-red-500'}`}>
                ₹{Math.abs(stats.netBalance).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </h3>
              <p className="text-xs text-gray-400">
                {stats.netBalance >= 0 ? 'You are owed in total' : 'You owe in total'}
              </p>
            </div>
            <div className={`p-3 rounded-2xl ${stats.netBalance >= 0 ? 'bg-secondary-50 dark:bg-secondary-950/20 text-secondary-500' : 'bg-red-50 dark:bg-red-950/20 text-red-500'}`}>
              <TrendingUp className="h-6 w-6" />
            </div>
          </div>
        </div>

        {/* Total Owed Card */}
        <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl shadow-sm ring-1 ring-black/5 dark:ring-white/5 relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div className="space-y-2">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total Owed</span>
              <h3 className="text-3xl font-extrabold text-red-500">
                ₹{stats.totalOwed.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </h3>
              <p className="text-xs text-gray-400">What you need to pay back</p>
            </div>
            <div className="p-3 rounded-2xl bg-red-50 dark:bg-red-950/20 text-red-500">
              <ArrowDownLeft className="h-6 w-6" />
            </div>
          </div>
        </div>

        {/* Total Receivable Card */}
        <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl shadow-sm ring-1 ring-black/5 dark:ring-white/5 relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div className="space-y-2">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total Receivable</span>
              <h3 className="text-3xl font-extrabold text-secondary-500">
                ₹{stats.totalReceivable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </h3>
              <p className="text-xs text-gray-400">What others owe you</p>
            </div>
            <div className="p-3 rounded-2xl bg-secondary-50 dark:bg-secondary-950/20 text-secondary-500">
              <ArrowUpRight className="h-6 w-6" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Layout Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Columns: Chart & Recent */}
        <div className="lg:col-span-2 space-y-8">
          {/* Chart Section */}
          <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl shadow-sm ring-1 ring-black/5 dark:ring-white/5">
            <h3 className="text-lg font-bold mb-6">Group Balances Breakdown</h3>
            {chartData.length > 0 ? (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" className="dark:stroke-gray-800" />
                    <XAxis 
                      dataKey="name" 
                      stroke="#9ca3af" 
                      fontSize={11} 
                      tickLine={false} 
                      axisLine={false} 
                      dy={8}
                    />
                    <YAxis 
                      stroke="#9ca3af" 
                      fontSize={11} 
                      tickLine={false} 
                      axisLine={false} 
                      dx={-8}
                    />
                    <Tooltip 
                      content={<CustomTooltip />}
                      cursor={{ fill: 'rgba(99, 102, 241, 0.03)' }}
                    />
                    <ReferenceLine y={0} stroke="#e5e7eb" className="dark:stroke-gray-800" strokeWidth={1.5} />
                    <Bar dataKey="Balance" fill="#6366f1" barSize={36} radius={6}>
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.Balance >= 0 ? '#10b981' : '#ef4444'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center border border-dashed border-gray-200 dark:border-gray-800 rounded-2xl">
                <p className="text-sm text-gray-400">No balances to display yet. Add some expenses!</p>
              </div>
            )}
          </div>

          {/* Recent Ledger Feed */}
          <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl shadow-sm ring-1 ring-black/5 dark:ring-white/5">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold">Recent Group Expenses</h3>
              <Link to="/groups" className="text-xs font-semibold text-primary-650 dark:text-primary-400 hover:underline flex items-center">
                <span>View all groups</span>
                <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Link>
            </div>

            {recentExpenses.length > 0 ? (
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {recentExpenses.map((exp) => (
                  <div key={exp._id} className="py-4 flex items-center justify-between first:pt-0 last:pb-0">
                    <div className="flex items-center space-x-3.5">
                      <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800 text-gray-500">
                        <Receipt className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{exp.title}</p>
                        <p className="text-xs text-gray-400">
                          Paid by {exp.paidBy?.name} in <span className="font-semibold">{exp.group?.name}</span> • {new Date(exp.expenseDate).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-sm">
                        {exp.currency === 'USD' ? '$' : '₹'}
                        {exp.amount.toLocaleString('en-IN')}
                      </p>
                      {exp.currency === 'USD' && (
                        <p className="text-[10px] text-gray-400">
                          ≈ ₹{exp.amountInINR.toLocaleString('en-IN', { maximumFractionDigits: 1 })}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center">
                <p className="text-sm text-gray-400">No expenses recorded yet.</p>
              </div>
            )}
          </div>
        </div>

        {/* Right 1 Column: User Groups list */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-900 p-6 rounded-3xl shadow-sm ring-1 ring-black/5 dark:ring-white/5">
            <h3 className="text-lg font-bold mb-5 flex items-center">
              <Users className="h-5 w-5 mr-2 text-primary-500" />
              <span>Your Groups</span>
            </h3>

            {groups.length > 0 ? (
              <div className="space-y-3.5">
                {groups.map((g) => {
                  const balanceRecord = stats.groups.find(bg => bg.groupId === g._id);
                  const bal = balanceRecord ? balanceRecord.balance : 0;
                  return (
                    <Link
                      key={g._id}
                      to={`/groups/${g._id}`}
                      className="flex items-center justify-between p-3.5 rounded-2xl border border-gray-100 dark:border-gray-850 hover:bg-gray-50 dark:hover:bg-gray-850 transition-colors"
                    >
                      <div className="truncate pr-2">
                        <p className="font-semibold text-sm truncate">{g.name}</p>
                        <p className="text-xs text-gray-400 truncate">{g.members?.length || 0} members</p>
                      </div>
                      <div className="flex items-center space-x-2 shrink-0">
                        <span className={`text-xs font-bold ${bal > 0 ? 'text-secondary-500' : bal < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                          {bal > 0 ? `+₹${bal}` : bal < 0 ? `-₹${Math.abs(bal)}` : 'Settle'}
                        </span>
                        <ChevronRight className="h-4 w-4 text-gray-400" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="py-8 text-center">
                <p className="text-xs text-gray-400 mb-4">You are not a member of any expense group.</p>
                <Link
                  to="/groups"
                  className="inline-flex items-center justify-center px-4 py-2 rounded-xl text-xs font-bold text-white bg-primary-600 hover:bg-primary-700 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  <span>Create Group</span>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
