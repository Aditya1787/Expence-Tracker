import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axiosInstance from '../utils/axiosInstance';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { 
  Users, 
  Plus, 
  ArrowLeft, 
  Receipt, 
  TrendingUp,
  UserPlus,
  HandCoins,
  History,
  Trash2,
  Edit,
  DollarSign,
  Info,
  Calendar,
  X,
  FileText
} from 'lucide-react';
import Spinner from '../components/common/Spinner';

const GroupDetails = () => {
  const { id: groupId } = useParams();
  const { user } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  // State Management
  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expenses, setExpenses] = useState([]);
  const [settlements, setSettlements] = useState([]);
  const [balances, setBalances] = useState([]);
  const [simplifiedDebts, setSimplifiedDebts] = useState([]);
  const [activeTab, setActiveTab] = useState('expenses'); // 'expenses' or 'settlements'

  // Search & Filter
  const [expenseSearch, setExpenseSearch] = useState('');
  const [expenseSplitFilter, setExpenseSplitFilter] = useState('');

  // Modal States
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showSettlementModal, setShowSettlementModal] = useState(false);

  // Modal Inputs
  const [inviteEmail, setInviteEmail] = useState('');
  const [currentExpense, setCurrentExpense] = useState(null); // null for create, object for edit
  const [expenseForm, setExpenseForm] = useState({
    title: '',
    description: '',
    amount: '',
    currency: 'INR',
    exchangeRate: '83.0',
    paidBy: '',
    expenseDate: new Date().toISOString().substring(0, 10),
    splitType: 'equal',
    participants: [] // list of { user, checked, shareAmount, percentage, shares }
  });
  
  const [settlementForm, setSettlementForm] = useState({
    payerId: '',
    receiverId: '',
    amount: '',
    date: new Date().toISOString().substring(0, 10),
    note: ''
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Get Group details
      const groupRes = await axiosInstance.get(`/groups/${groupId}`);
      setGroup(groupRes.data.group);

      // Get group balances & simplified debts
      const balanceRes = await axiosInstance.get(`/balances/group/${groupId}`);
      setBalances(balanceRes.data.balances);
      setSimplifiedDebts(balanceRes.data.simplifiedSettlements);

      // Get group expenses
      const expensesRes = await axiosInstance.get(`/expenses/group/${groupId}`);
      setExpenses(expensesRes.data.expenses);

      // Get group settlements
      const settlementsRes = await axiosInstance.get(`/settlements?groupId=${groupId}`);
      setSettlements(settlementsRes.data.settlements || []);

    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to fetch group details', 'error');
      navigate('/groups');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [groupId]);

  // Member management handlers
  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    try {
      const res = await axiosInstance.post(`/groups/${groupId}/members`, { email: inviteEmail });
      if (res.data.success) {
        addToast('Member invited successfully!', 'success');
        setInviteEmail('');
        setShowMemberModal(false);
        fetchData();
      }
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to add member', 'error');
    }
  };

  const handleLeaveGroup = async (memberUserId) => {
    if (!window.confirm('Are you sure you want to leave this group? You will not participate in any future expenses.')) return;
    try {
      const res = await axiosInstance.delete(`/groups/${groupId}/members/${memberUserId}`);
      if (res.data.success) {
        addToast('Successfully left the group', 'success');
        fetchData();
      }
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to leave group', 'error');
    }
  };

  const handleDeleteGroup = async () => {
    if (!window.confirm('WARNING: Are you sure you want to delete this group permanently? All history will be lost.')) return;
    try {
      const res = await axiosInstance.delete(`/groups/${groupId}`);
      if (res.data.success) {
        addToast('Group deleted successfully', 'success');
        navigate('/groups');
      }
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to delete group', 'error');
    }
  };

  // Open Expense Modal for Create
  const openAddExpenseModal = () => {
    setCurrentExpense(null);
    const initialParticipants = group.members
      .filter(m => m.status === 'ACTIVE')
      .map(m => ({
        user: m.user,
        checked: true,
        shareAmount: '',
        percentage: '',
        shares: 1
      }));

    setExpenseForm({
      title: '',
      description: '',
      amount: '',
      currency: 'INR',
      exchangeRate: '83.0',
      paidBy: user._id,
      expenseDate: new Date().toISOString().substring(0, 10),
      splitType: 'equal',
      participants: initialParticipants
    });
    setShowExpenseModal(true);
  };

  // Open Expense Modal for Edit
  const openEditExpenseModal = (exp) => {
    setCurrentExpense(exp);
    const existingParts = exp.participants.reduce((acc, p) => {
      acc[p.user._id.toString()] = p;
      return acc;
    }, {});

    const initialParticipants = group.members.map(m => {
      const matched = existingParts[m.user._id.toString()];
      return {
        user: m.user,
        checked: !!matched,
        shareAmount: matched ? matched.shareAmount : '',
        percentage: matched ? matched.percentage || '' : '',
        shares: matched ? matched.shares || 1 : 1
      };
    });

    setExpenseForm({
      title: exp.title,
      description: exp.description || '',
      amount: exp.amount,
      currency: exp.currency,
      exchangeRate: exp.exchangeRate.toString(),
      paidBy: exp.paidBy._id,
      expenseDate: new Date(exp.expenseDate).toISOString().substring(0, 10),
      splitType: exp.splitType,
      participants: initialParticipants
    });
    setShowExpenseModal(true);
  };

  // Submit Expense Creator/Editor
  const handleExpenseSubmit = async (e) => {
    e.preventDefault();

    const selectedParts = expenseForm.participants.filter(p => p.checked);
    if (selectedParts.length === 0) {
      addToast('Select at least one participant', 'error');
      return;
    }

    const amt = parseFloat(expenseForm.amount);
    if (isNaN(amt) || amt <= 0) {
      addToast('Please provide a valid amount', 'error');
      return;
    }

    // Prepare participants structure
    const mappedParticipants = selectedParts.map(p => {
      const record = { user: p.user._id };
      if (expenseForm.splitType === 'exact') {
        record.shareAmount = parseFloat(p.shareAmount) || 0;
      } else if (expenseForm.splitType === 'percentage') {
        record.percentage = parseFloat(p.percentage) || 0;
      } else if (expenseForm.splitType === 'shares') {
        record.shares = parseFloat(p.shares) || 1;
      }
      return record;
    });

    const payload = {
      groupId,
      title: expenseForm.title,
      description: expenseForm.description,
      amount: amt,
      currency: expenseForm.currency,
      exchangeRate: parseFloat(expenseForm.exchangeRate) || 1.0,
      paidBy: expenseForm.paidBy,
      expenseDate: expenseForm.expenseDate,
      splitType: expenseForm.splitType,
      participants: mappedParticipants
    };

    try {
      if (currentExpense) {
        // Edit Mode
        const res = await axiosInstance.put(`/expenses/${currentExpense._id}`, payload);
        if (res.data.success) {
          addToast('Expense updated successfully!', 'success');
        }
      } else {
        // Create Mode
        const res = await axiosInstance.post('/expenses', payload);
        if (res.data.success) {
          addToast('Expense added successfully!', 'success');
        }
      }
      setShowExpenseModal(false);
      fetchData();
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to save expense. Verify timeline parameters.', 'error');
    }
  };

  const handleDeleteExpense = async (expenseId) => {
    if (!window.confirm('Delete this expense?')) return;
    try {
      const res = await axiosInstance.delete(`/expenses/${expenseId}`);
      if (res.data.success) {
        addToast('Expense deleted successfully', 'success');
        fetchData();
      }
    } catch (err) {
      addToast('Failed to delete expense', 'error');
    }
  };

  // Open Settlement Modal
  const openSettlementModal = (deb = null) => {
    setSettlementForm({
      payerId: deb ? deb.from : '',
      receiverId: deb ? deb.to : '',
      amount: deb ? deb.amount : '',
      date: new Date().toISOString().substring(0, 10),
      note: deb ? `Simplified settlement payout` : ''
    });
    setShowSettlementModal(true);
  };

  // Submit Settlement
  const handleSettlementSubmit = async (e) => {
    e.preventDefault();
    const amt = parseFloat(settlementForm.amount);

    if (!settlementForm.payerId || !settlementForm.receiverId) {
      addToast('Select both payer and receiver', 'error');
      return;
    }
    if (isNaN(amt) || amt <= 0) {
      addToast('Provide a valid repayment amount', 'error');
      return;
    }

    try {
      const res = await axiosInstance.post('/settlements', {
        groupId,
        payerId: settlementForm.payerId,
        receiverId: settlementForm.receiverId,
        amount: amt,
        date: settlementForm.date,
        note: settlementForm.note
      });

      if (res.data.success) {
        addToast('Settlement payment recorded!', 'success');
        setShowSettlementModal(false);
        fetchData();
      }
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to record settlement', 'error');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[75vh]">
        <Spinner size="large" />
        <p className="mt-4 text-sm text-gray-500 dark:text-gray-400 font-medium">Loading ledger book...</p>
      </div>
    );
  }

  // Filter expenses list locally
  const filteredExpenses = expenses.filter(exp => {
    const matchesSearch = exp.title.toLowerCase().includes(expenseSearch.toLowerCase()) || 
                          (exp.description && exp.description.toLowerCase().includes(expenseSearch.toLowerCase()));
    const matchesSplit = expenseSplitFilter ? exp.splitType === expenseSplitFilter : true;
    return matchesSearch && matchesSplit;
  });

  return (
    <div className="space-y-8">
      {/* Header breadcrumb */}
      <div className="flex items-center justify-between">
        <Link to="/groups" className="inline-flex items-center text-sm font-semibold text-gray-500 dark:text-gray-400 hover:text-primary-550 transition-colors">
          <ArrowLeft className="h-4 w-4 mr-2" />
          <span>Back to Groups</span>
        </Link>
        {group.createdBy._id === user._id && (
          <button
            onClick={handleDeleteGroup}
            className="inline-flex items-center text-xs font-bold text-red-650 hover:underline"
          >
            <Trash2 className="h-4 w-4 mr-1" />
            <span>Delete Group</span>
          </button>
        )}
      </div>

      {/* Main Details Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Hand Card: Group Summary, Balances & Simplified Repayments */}
        <div className="space-y-6">
          
          {/* Group Info Card */}
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-sm ring-1 ring-black/5 dark:ring-white/5">
            <h2 className="text-xl font-bold mb-2">{group.name}</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{group.description || 'No description'}</p>
            <div className="flex flex-wrap gap-2.5">
              <button
                onClick={openAddExpenseModal}
                className="inline-flex items-center px-4 py-2 rounded-xl text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700 transition-colors"
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                <span>Add Expense</span>
              </button>
              <button
                onClick={() => openSettlementModal()}
                className="inline-flex items-center px-4 py-2 rounded-xl text-xs font-semibold text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-850 transition-colors"
              >
                <HandCoins className="h-3.5 w-3.5 mr-1" />
                <span>Settle Debt</span>
              </button>
            </div>
          </div>

          {/* Simplified Debt Settlements */}
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-sm ring-1 ring-black/5 dark:ring-white/5">
            <h3 className="text-md font-bold mb-4 flex items-center">
              <TrendingUp className="h-4 w-4 mr-2 text-secondary-500" />
              <span>Simplified Debts</span>
            </h3>
            {simplifiedDebts.length > 0 ? (
              <div className="space-y-3">
                {simplifiedDebts.map((deb, index) => (
                  <div key={index} className="flex items-center justify-between p-3.5 rounded-2xl bg-gray-50 dark:bg-gray-850/50 border border-gray-100 dark:border-gray-800/40">
                    <div className="text-xs">
                      <span className="font-semibold text-red-500">{deb.fromName}</span>
                      <span className="text-gray-400"> owes </span>
                      <span className="font-semibold text-secondary-500">{deb.toName}</span>
                      <p className="font-bold text-sm mt-1">₹{deb.amount.toLocaleString('en-IN')}</p>
                    </div>
                    {/* If current user is either payer or receiver, let them click to auto settle */}
                    <button
                      onClick={() => openSettlementModal(deb)}
                      className="px-3 py-1.5 rounded-xl bg-primary-50 hover:bg-primary-100 dark:bg-primary-950/40 dark:hover:bg-primary-900/60 text-primary-600 dark:text-primary-400 text-xs font-bold transition-all"
                    >
                      Settle
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 border border-dashed border-gray-200 dark:border-gray-800 rounded-2xl">
                <p className="text-xs text-gray-400">Ledger balance is completely settled!</p>
              </div>
            )}
          </div>

          {/* Member Balance Ledger */}
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-sm ring-1 ring-black/5 dark:ring-white/5">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-md font-bold flex items-center">
                <Users className="h-4 w-4 mr-2 text-primary-500" />
                <span>Balances</span>
              </h3>
              <button
                onClick={() => setShowMemberModal(true)}
                className="p-1 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-850 text-primary-655"
              >
                <UserPlus className="h-4.5 w-4.5" />
              </button>
            </div>
            
            <div className="space-y-4">
              {balances.map((b) => (
                <div key={b.user._id} className="flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-2.5">
                    <img
                      src={b.user.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${b.user.name}`}
                      alt={b.user.name}
                      className="h-7 w-7 rounded-full"
                    />
                    <div>
                      <p className="font-semibold">{b.user.name}</p>
                      <p className="text-[10px] text-gray-400">
                        {b.status === 'LEFT' ? 'Left group' : 'Active'}
                      </p>
                    </div>
                  </div>
                  <span className={`font-bold ${b.balance > 0 ? 'text-secondary-500' : b.balance < 0 ? 'text-red-500' : 'text-gray-400'}`}>
                    {b.balance > 0 ? `+₹${b.balance}` : b.balance < 0 ? `-₹${Math.abs(b.balance)}` : '₹0.00'}
                  </span>
                </div>
              ))}
            </div>

            {/* History of joined/left times */}
            <div className="mt-6 pt-5 border-t border-gray-100 dark:border-gray-800 space-y-3">
              <h4 className="text-xs font-bold text-gray-450 uppercase flex items-center">
                <History className="h-3.5 w-3.5 mr-1" />
                <span>Membership Timeline</span>
              </h4>
              <div className="space-y-2">
                {group.members.map((m) => (
                  <div key={m.user._id} className="text-[10px] text-gray-400 flex items-center justify-between">
                    <span>{m.user.name}</span>
                    <span className="font-mono">
                      {new Date(m.joinedAt).toLocaleDateString()} - {m.leftAt ? new Date(m.leftAt).toLocaleDateString() : 'Active'}
                    </span>
                  </div>
                ))}
              </div>
              
              {/* Option to leave group */}
              {group.members.some(m => m.user._id.toString() === user._id.toString() && m.status === 'ACTIVE') && (
                <button
                  onClick={() => handleLeaveGroup(user._id)}
                  className="mt-2 text-red-500 hover:text-red-600 text-[10px] font-bold block"
                >
                  Leave Group
                </button>
              )}
            </div>

          </div>

        </div>

        {/* Right Hand: Tabs (Expenses, Settlements) and lists */}
        <div className="lg:col-span-2 space-y-6">
          {/* Tab Selection */}
          <div className="flex border-b border-gray-200 dark:border-gray-800">
            <button
              onClick={() => setActiveTab('expenses')}
              className={`pb-4 px-6 text-sm font-semibold border-b-2 transition-all ${
                activeTab === 'expenses'
                  ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              Group Expenses ({expenses.length})
            </button>
            <button
              onClick={() => setActiveTab('settlements')}
              className={`pb-4 px-6 text-sm font-semibold border-b-2 transition-all ${
                activeTab === 'settlements'
                  ? 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                  : 'border-primary-500 text-primary-600 dark:text-primary-400'
              }`}
            >
              Repayments recorded ({settlements.length})
            </button>
          </div>

          {activeTab === 'expenses' ? (
            <div className="space-y-6">
              {/* Filter controls */}
              <div className="flex flex-col md:flex-row gap-4">
                <input
                  type="text"
                  placeholder="Search expenses..."
                  value={expenseSearch}
                  onChange={(e) => setExpenseSearch(e.target.value)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                />
                <select
                  value={expenseSplitFilter}
                  onChange={(e) => setExpenseSplitFilter(e.target.value)}
                  className="px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                >
                  <option value="">All Split Methods</option>
                  <option value="equal">Equal Split</option>
                  <option value="exact">Exact Split</option>
                  <option value="percentage">Percentage Split</option>
                  <option value="shares">Shares Split</option>
                </select>
              </div>

              {/* Expenses list */}
              {filteredExpenses.length > 0 ? (
                <div className="space-y-4">
                  {filteredExpenses.map((exp) => (
                    <div
                      key={exp._id}
                      className="bg-white dark:bg-gray-900 rounded-3xl p-5 shadow-sm ring-1 ring-black/5 dark:ring-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div className="flex items-start space-x-3.5">
                        <div className="p-3 bg-gray-50 dark:bg-gray-800 text-gray-500 rounded-2xl mt-0.5">
                          <Receipt className="h-5 w-5" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-sm">{exp.title}</h4>
                          <p className="text-xs text-gray-400">
                            Paid by <span className="font-semibold text-gray-700 dark:text-gray-300">{exp.paidBy?.name}</span> • {new Date(exp.expenseDate).toLocaleDateString()}
                          </p>
                          {exp.description && (
                            <p className="text-xs text-gray-550 dark:text-gray-450 mt-1 italic">
                              "{exp.description}"
                            </p>
                          )}

                          {/* Render participants details */}
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {exp.participants.map((p) => (
                              <span
                                key={p.user._id}
                                className="text-[10px] px-2 py-0.5 rounded-lg bg-gray-50 dark:bg-gray-800 text-gray-500 border border-gray-100 dark:border-gray-850"
                              >
                                {p.user?.name}: {exp.currency === 'USD' ? '$' : '₹'}{p.shareAmount}
                              </span>
                            ))}
                          </div>

                        </div>
                      </div>

                      <div className="flex md:flex-col items-end justify-between md:justify-center border-t md:border-t-0 border-gray-100 dark:border-gray-800 pt-3 md:pt-0 shrink-0">
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
                          <span className="inline-block text-[9px] uppercase font-bold tracking-wider text-primary-500 bg-primary-50 dark:bg-primary-950/40 px-2 py-0.5 rounded-md mt-1">
                            {exp.splitType}
                          </span>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center space-x-2 mt-2">
                          <button
                            onClick={() => openEditExpenseModal(exp)}
                            className="p-1.5 text-gray-400 hover:text-primary-500 hover:bg-gray-50 dark:hover:bg-gray-850 rounded-lg transition-colors"
                          >
                            <Edit className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteExpense(exp._id)}
                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/25 rounded-lg transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>

                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 bg-white dark:bg-gray-900 rounded-3xl border border-dashed border-gray-200 dark:border-gray-800">
                  <p className="text-sm text-gray-400">No expenses match your search filters.</p>
                </div>
              )}
            </div>
          ) : (
            // Settlements View
            <div className="space-y-4">
              {settlements.length > 0 ? (
                <div className="space-y-3">
                  {settlements.map((setl) => (
                    <div
                      key={setl._id}
                      className="bg-white dark:bg-gray-900 rounded-3xl p-4 shadow-sm ring-1 ring-black/5 dark:ring-white/5 flex items-center justify-between"
                    >
                      <div className="flex items-center space-x-3">
                        <div className="p-2.5 bg-green-50 dark:bg-green-950/20 text-green-500 rounded-2xl">
                          <HandCoins className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-xs">
                            <span className="font-semibold">{setl.payer?.name}</span>
                            <span className="text-gray-400"> paid </span>
                            <span className="font-semibold">{setl.receiver?.name}</span>
                          </p>
                          <p className="text-[10px] text-gray-400">
                            {new Date(setl.date).toLocaleDateString()} {setl.note && `• "${setl.note}"`}
                          </p>
                        </div>
                      </div>
                      <span className="font-bold text-sm text-green-500">
                        ₹{setl.amount.toLocaleString('en-IN')}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 bg-white dark:bg-gray-900 rounded-3xl border border-dashed border-gray-200 dark:border-gray-800">
                  <p className="text-sm text-gray-400">No settlements recorded yet in this group.</p>
                </div>
              )}
            </div>
          )}

        </div>

      </div>

      {/* 1. Modal: Add Member */}
      {showMemberModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 max-w-md w-full shadow-2xl animate-scale-up">
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-gray-100 dark:border-gray-800">
              <h3 className="text-lg font-bold flex items-center">
                <UserPlus className="h-5 w-5 mr-2 text-primary-500" />
                <span>Add Member</span>
              </h3>
              <button onClick={() => setShowMemberModal(false)} className="text-gray-450 hover:bg-gray-50 dark:hover:bg-gray-850 p-1 rounded-lg">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleAddMember} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  User Email Address
                </label>
                <input
                  type="email"
                  placeholder="name@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="block w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                  required
                />
              </div>
              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold transition-colors"
              >
                Invite Member
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 2. Modal: Settlement Repayment Form */}
      {showSettlementModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 max-w-md w-full shadow-2xl animate-scale-up">
            <div className="flex justify-between items-center mb-5 pb-3 border-b border-gray-100 dark:border-gray-800">
              <h3 className="text-lg font-bold flex items-center">
                <HandCoins className="h-5 w-5 mr-2 text-secondary-500" />
                <span>Record Repayment</span>
              </h3>
              <button onClick={() => setShowSettlementModal(false)} className="text-gray-450 hover:bg-gray-50 dark:hover:bg-gray-850 p-1 rounded-lg">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSettlementSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Who Paid?</label>
                <select
                  value={settlementForm.payerId}
                  onChange={(e) => setSettlementForm(prev => ({ ...prev, payerId: e.target.value }))}
                  className="block w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                  required
                >
                  <option value="">Select payer</option>
                  {group.members.map(m => (
                    <option key={m.user._id} value={m.user._id}>{m.user.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Who Received?</label>
                <select
                  value={settlementForm.receiverId}
                  onChange={(e) => setSettlementForm(prev => ({ ...prev, receiverId: e.target.value }))}
                  className="block w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                  required
                >
                  <option value="">Select receiver</option>
                  {group.members.map(m => (
                    <option key={m.user._id} value={m.user._id}>{m.user.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Amount (INR)</label>
                  <input
                    type="number"
                    step="any"
                    value={settlementForm.amount}
                    onChange={(e) => setSettlementForm(prev => ({ ...prev, amount: e.target.value }))}
                    className="block w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Date</label>
                  <input
                    type="date"
                    value={settlementForm.date}
                    onChange={(e) => setSettlementForm(prev => ({ ...prev, date: e.target.value }))}
                    className="block w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">Repayment Note</label>
                <input
                  type="text"
                  placeholder="e.g. UPI, cash transfer"
                  value={settlementForm.note}
                  onChange={(e) => setSettlementForm(prev => ({ ...prev, note: e.target.value }))}
                  className="block w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-secondary-600 hover:bg-secondary-700 text-white text-sm font-semibold transition-colors"
              >
                Record Payout
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 3. Modal: Add/Edit Expense Form */}
      {showExpenseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 max-w-xl w-full my-8 shadow-2xl animate-scale-up">
            
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-100 dark:border-gray-800">
              <h3 className="text-lg font-bold flex items-center">
                <Receipt className="h-5 w-5 mr-2 text-primary-500" />
                <span>{currentExpense ? 'Edit Expense' : 'Add Expense'}</span>
              </h3>
              <button onClick={() => setShowExpenseModal(false)} className="text-gray-450 hover:bg-gray-50 dark:hover:bg-gray-850 p-1 rounded-lg">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleExpenseSubmit} className="space-y-4">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Expense Title *</label>
                  <input
                    type="text"
                    placeholder="e.g. Groceries BigBasket"
                    value={expenseForm.title}
                    onChange={(e) => setExpenseForm(prev => ({ ...prev, title: e.target.value }))}
                    className="block w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Description</label>
                  <input
                    type="text"
                    placeholder="e.g. Bread, eggs, milk"
                    value={expenseForm.description}
                    onChange={(e) => setExpenseForm(prev => ({ ...prev, description: e.target.value }))}
                    className="block w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                  />
                </div>
              </div>

              {/* Amount, Currency & Payer */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                
                <div className="col-span-1">
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Currency</label>
                  <select
                    value={expenseForm.currency}
                    onChange={(e) => setExpenseForm(prev => ({ ...prev, currency: e.target.value }))}
                    className="block w-full px-3 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                  >
                    <option value="INR">INR (₹)</option>
                    <option value="USD">USD ($)</option>
                  </select>
                </div>

                <div className="col-span-1">
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Amount *</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="0.00"
                    value={expenseForm.amount}
                    onChange={(e) => setExpenseForm(prev => ({ ...prev, amount: e.target.value }))}
                    className="block w-full px-3 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                    required
                  />
                </div>

                {expenseForm.currency === 'USD' && (
                  <div className="col-span-2 md:col-span-1">
                    <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">USD/INR Rate</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="83.0"
                      value={expenseForm.exchangeRate}
                      onChange={(e) => setExpenseForm(prev => ({ ...prev, exchangeRate: e.target.value }))}
                      className="block w-full px-3 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                    />
                  </div>
                )}

                <div className="col-span-2 md:col-span-1">
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Paid By *</label>
                  <select
                    value={expenseForm.paidBy}
                    onChange={(e) => setExpenseForm(prev => ({ ...prev, paidBy: e.target.value }))}
                    className="block w-full px-3 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                    required
                  >
                    {group.members.map(m => (
                      <option key={m.user._id} value={m.user._id}>{m.user.name}</option>
                    ))}
                  </select>
                </div>

                <div className="col-span-2 md:col-span-1">
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Date *</label>
                  <input
                    type="date"
                    value={expenseForm.expenseDate}
                    onChange={(e) => setExpenseForm(prev => ({ ...prev, expenseDate: e.target.value }))}
                    className="block w-full px-3 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                    required
                  />
                </div>

              </div>

              {/* Split type select */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Split Type</label>
                <select
                  value={expenseForm.splitType}
                  onChange={(e) => setExpenseForm(prev => ({ ...prev, splitType: e.target.value }))}
                  className="block w-full px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                >
                  <option value="equal">Split Equally</option>
                  <option value="exact">Split Exact Amounts</option>
                  <option value="percentage">Split Percentages</option>
                  <option value="shares">Split Share Counts</option>
                </select>
              </div>

              {/* Participants selection grid */}
              <div className="space-y-3 border border-gray-100 dark:border-gray-800 p-4 rounded-2xl bg-gray-50/50 dark:bg-gray-950/30">
                <span className="block text-xs font-bold text-gray-450 uppercase mb-2">Split Participants</span>
                
                <div className="space-y-2.5">
                  {expenseForm.participants.map((p, index) => (
                    <div key={p.user._id} className="flex items-center justify-between">
                      <label className="flex items-center space-x-2.5 text-sm select-none cursor-pointer">
                        <input
                          type="checkbox"
                          checked={p.checked}
                          onChange={(e) => {
                            const updated = [...expenseForm.participants];
                            updated[index].checked = e.target.checked;
                            setExpenseForm(prev => ({ ...prev, participants: updated }));
                          }}
                          className="rounded text-primary-600 focus:ring-primary-500 h-4 w-4"
                        />
                        <span className="text-xs">{p.user.name}</span>
                      </label>

                      {p.checked && expenseForm.splitType !== 'equal' && (
                        <div className="flex items-center space-x-2 shrink-0">
                          {expenseForm.splitType === 'exact' && (
                            <>
                              <span className="text-xs text-gray-400">{expenseForm.currency === 'USD' ? '$' : '₹'}</span>
                              <input
                                type="number"
                                placeholder="exact"
                                value={p.shareAmount}
                                onChange={(e) => {
                                  const updated = [...expenseForm.participants];
                                  updated[index].shareAmount = e.target.value;
                                  setExpenseForm(prev => ({ ...prev, participants: updated }));
                                }}
                                className="w-20 px-2 py-1 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 rounded-lg text-xs"
                                required
                              />
                            </>
                          )}
                          {expenseForm.splitType === 'percentage' && (
                            <>
                              <input
                                type="number"
                                placeholder="%"
                                value={p.percentage}
                                onChange={(e) => {
                                  const updated = [...expenseForm.participants];
                                  updated[index].percentage = e.target.value;
                                  setExpenseForm(prev => ({ ...prev, participants: updated }));
                                }}
                                className="w-16 px-2 py-1 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 rounded-lg text-xs"
                                required
                              />
                              <span className="text-xs text-gray-400">%</span>
                            </>
                          )}
                          {expenseForm.splitType === 'shares' && (
                            <>
                              <input
                                type="number"
                                placeholder="shares"
                                value={p.shares}
                                onChange={(e) => {
                                  const updated = [...expenseForm.participants];
                                  updated[index].shares = e.target.value;
                                  setExpenseForm(prev => ({ ...prev, participants: updated }));
                                }}
                                className="w-16 px-2 py-1 border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 rounded-lg text-xs"
                                required
                              />
                              <span className="text-xs text-gray-400">shares</span>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold transition-colors"
              >
                {currentExpense ? 'Save Changes' : 'Post Expense'}
              </button>

            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default GroupDetails;
