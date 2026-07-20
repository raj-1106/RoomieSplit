import { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useRoomiesplit, OnChainGroup, OnChainExpense } from '@/hooks/use-roomiesplit';
import { ArrowLeft, Plus, Users, Receipt, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// Local index for group name/description — only the creator ever writes this
// to localStorage, so non-creator members fall back to a generic label derived
// from the on-chain group ID. All balances, expenses, and member lists still
// come from the chain, fetched fresh each time.
interface GroupIndexEntry {
  creator: string;
  groupId: string;
  name: string;
  description: string;
}

export const GroupDashboard = () => {
  const { connected, publicKey } = useWallet();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { addExpense: addExpenseOnChain, calculateBalances: calculateBalancesOnChain, fetchGroup, fetchExpenses, settleDebt: settleDebtOnChain, getUserGroups } = useRoomiesplit();

  const [groupIndex, setGroupIndex] = useState<GroupIndexEntry[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [onChainGroup, setOnChainGroup] = useState<OnChainGroup | null>(null);
  const [expenses, setExpenses] = useState<OnChainExpense[]>([]);
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);

  const [expenseDescription, setExpenseDescription] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expensePaidBy, setExpensePaidBy] = useState<string>('');
  const [isSubmittingExpense, setIsSubmittingExpense] = useState(false);

  // Loads groups from localStorage only — instant, no RPC call.
  const loadAllGroups = () => {
    setIsLoadingGroups(true);
    const savedIndex = JSON.parse(localStorage.getItem('groupIndex') || '[]') as GroupIndexEntry[];
    setGroupIndex(savedIndex);
    if (savedIndex.length > 0 && !selectedGroupId) {
      setSelectedGroupId(savedIndex[0].groupId);
    }
    setIsLoadingGroups(false);
  };

  // Manual on-chain scan — fetches ALL program accounts (heavy!).
  // Only called when the user explicitly clicks Refresh, not on mount.
  const scanChainForGroups = async () => {
    if (isScanning) return;
    setIsScanning(true);
    const savedIndex = JSON.parse(localStorage.getItem('groupIndex') || '[]') as GroupIndexEntry[];
    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('RPC timeout — getProgramAccounts took too long')), 15_000)
      );
      const onChainGroups = await Promise.race([getUserGroups(), timeoutPromise]);

      const merged = onChainGroups.map(g => {
        const localEntry = savedIndex.find(e => e.groupId === g.groupId.toString());
        return {
          creator: g.creator.toString(),
          groupId: g.groupId.toString(),
          name: localEntry?.name ?? `Group #${g.groupId.toString()}`,
          description: localEntry?.description ?? '',
        };
      });

      setGroupIndex(merged);
      if (merged.length > 0 && !selectedGroupId) setSelectedGroupId(merged[0].groupId);
      toast({ title: 'Scan complete', description: `Found ${merged.length} group(s) on-chain.` });
    } catch (error: any) {
      console.error('Chain scan error:', error?.message ?? error);
      toast({
        title: error?.message?.includes('timeout') ? 'RPC Slow' : 'Scan Failed',
        description: error?.message?.includes('timeout')
          ? 'Devnet timed out. Your created groups are still shown from cache.'
          : 'Failed to scan on-chain groups.',
        variant: 'destructive',
      });
    } finally {
      setIsScanning(false);
    }
  };

  useEffect(() => {
    if (connected && publicKey) {
      loadAllGroups();
    }
  }, [connected, publicKey?.toString()]);

  useEffect(() => {
    if (selectedGroupId && groupIndex.length > 0) {
      const entry = groupIndex.find(g => g.groupId === selectedGroupId);
      if (entry) {
        loadGroupData(entry.creator, entry.groupId);
      }
    }
    // Intentionally omitting groupIndex from deps — we only want to refetch
    // group data when the selected group changes, not every time the group list
    // updates (e.g. after the background on-chain scan completes).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGroupId]);

  const pruneStaleEntry = (groupId: string) => {
    const saved = JSON.parse(localStorage.getItem('groupIndex') || '[]') as GroupIndexEntry[];
    const pruned = saved.filter(e => e.groupId !== groupId);
    localStorage.setItem('groupIndex', JSON.stringify(pruned));
    setGroupIndex(prev => prev.filter(e => e.groupId !== groupId));
    if (selectedGroupId === groupId) {
      setSelectedGroupId(pruned[0]?.groupId ?? null);
      setOnChainGroup(null);
      setExpenses([]);
    }
  };

  const clearAllGroups = () => {
    localStorage.removeItem('groupIndex');
    setGroupIndex([]);
    setSelectedGroupId(null);
    setOnChainGroup(null);
    setExpenses([]);
  };

  const loadGroupData = async (creatorAddress: string, groupId: string) => {
    setIsLoadingDetail(true);
    setOnChainGroup(null);
    setExpenses([]);
    try {
      const creatorPk = new PublicKey(creatorAddress);
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('RPC timeout — account fetch took too long')), 12_000)
      );
      const [group, groupExpenses] = await Promise.race([
        Promise.all([fetchGroup(creatorPk, groupId), fetchExpenses(creatorPk, groupId)]),
        timeout,
      ]);

      if (!group) {
        // Account doesn't exist on-chain or has a corrupted layout — auto-prune it.
        console.warn(`Group ${groupId} returned null from chain — pruning stale localStorage entry.`);
        pruneStaleEntry(groupId);
        toast({
          title: 'Stale group removed',
          description: 'This group no longer exists on-chain (likely created with an older program version). It has been removed from your list.',
          variant: 'destructive',
        });
        return;
      }

      setOnChainGroup(group);
      setExpenses(groupExpenses);
    } catch (error: any) {
      console.error('Error loading group data:', error);
      const isTimeout = error?.message?.includes('timeout');
      toast({
        title: isTimeout ? 'RPC Slow' : 'Error',
        description: isTimeout
          ? 'Devnet RPC timed out fetching group data. Try clicking the group again in a moment.'
          : 'Failed to load group data from chain',
        variant: 'destructive',
      });
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const handleAddExpense = async () => {
    const entry = groupIndex.find(g => g.groupId === selectedGroupId);
    if (!entry || !expenseDescription.trim() || !expenseAmount || !expensePaidBy) {
      toast({
        title: 'Missing Information',
        description: 'Please fill in all required fields including who paid',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmittingExpense(true);
    try {
      const creatorPk = new PublicKey(entry.creator);
      await addExpenseOnChain(creatorPk, entry.groupId, parseFloat(expenseAmount), expenseDescription.trim(), expensePaidBy);

      // recalculate balances on-chain immediately so the dashboard reflects the new expense
      await calculateBalancesOnChain(creatorPk, entry.groupId);
      await loadGroupData(entry.creator, entry.groupId);

      setExpenseDescription('');
      setExpenseAmount('');
      setExpensePaidBy('');
      setIsAddExpenseOpen(false);
    } catch (error) {
      // addExpenseOnChain already surfaces a toast on failure
      console.error('Error adding expense:', error);
    } finally {
      setIsSubmittingExpense(false);
    }
  };

  const handleSettle = async (fromAddress: string, toAddress: string, amount: number) => {
    const entry = groupIndex.find(g => g.groupId === selectedGroupId);
    if (!entry) return;
    try {
      const creatorPk = new PublicKey(entry.creator);
      await settleDebtOnChain(creatorPk, entry.groupId, new PublicKey(toAddress), amount);
      await calculateBalancesOnChain(creatorPk, entry.groupId);
      await loadGroupData(entry.creator, entry.groupId);
    } catch (error) {
      console.error('Error settling:', error);
    }
  };

  const formatAddress = (address: string) => `${address.slice(0, 8)}...${address.slice(-8)}`;

  // Uses the real on-chain balances (owed = spent - fair_share, computed by the
  // program) instead of recomputing balance math client-side.
  const getSettlements = () => {
    if (!onChainGroup) return [];

    const balances = onChainGroup.balances.map(b => ({
      member: b.member.toString(),
      owed: b.owed.toNumber() / 100, // paise -> INR
    }));

    const settlements: Array<{ from: string; to: string; amount: number }> = [];
    const creditors = balances.filter(b => b.owed > 0).map(b => ({ ...b }));
    const debtors = balances.filter(b => b.owed < 0).map(b => ({ ...b, owed: -b.owed }));

    for (const creditor of creditors) {
      for (const debtor of debtors) {
        if (creditor.owed <= 0.000001 || debtor.owed <= 0.000001) continue;
        const settleAmount = Math.min(creditor.owed, debtor.owed);
        settlements.push({ from: debtor.member, to: creditor.member, amount: settleAmount });
        creditor.owed -= settleAmount;
        debtor.owed -= settleAmount;
      }
    }

    return settlements.filter(s => s.amount > 0.000001);
  };

  if (!connected) {
    return (
      <div className="min-h-screen bg-gradient-hero flex items-center justify-center">
        <Card className="bg-gradient-card backdrop-blur-sm border-primary/20 max-w-md">
          <CardHeader>
            <CardTitle>Wallet Required</CardTitle>
            <CardDescription>Please connect your wallet to view your dashboard</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="wallet" onClick={() => navigate('/')} className="w-full">
              Go Back to Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (groupIndex.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-hero flex items-center justify-center">
        <Card className="bg-gradient-card backdrop-blur-sm border-primary/20 max-w-md">
          <CardHeader>
            <CardTitle>{isLoadingGroups ? 'Loading Groups...' : 'No Groups Found'}</CardTitle>
            <CardDescription>
              {isLoadingGroups
                ? 'Scanning on-chain for groups you belong to...'
                : 'You are not a member of any on-chain groups yet.'}
            </CardDescription>
          </CardHeader>
          {!isLoadingGroups && (
            <CardContent>
              <Button variant="hero" onClick={() => navigate('/create-group')} className="w-full">
                Create Your First Group
              </Button>
            </CardContent>
          )}
          {isLoadingGroups && (
            <CardContent className="flex justify-center py-4">
              <RefreshCw className="h-6 w-6 animate-spin text-primary" />
            </CardContent>
          )}
        </Card>
      </div>
    );
  }

  const settlements = getSettlements();
  const selectedIndexEntry = groupIndex.find(g => g.groupId === selectedGroupId);

  return (
    <div className="min-h-screen bg-gradient-hero">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center">
            <Button variant="ghost" onClick={() => navigate('/')} className="mr-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <h1 className="text-3xl font-bold">Dashboard</h1>
          </div>
          <Button variant="hero" onClick={() => navigate('/create-group')}>
            <Plus className="h-4 w-4 mr-2" />
            New Group
          </Button>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1">
            <Card className="bg-gradient-card backdrop-blur-sm border-primary/20 shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center">
                    <Users className="h-5 w-5 mr-2" />
                    Your Groups
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-muted-foreground hover:text-primary"
                      onClick={scanChainForGroups}
                      disabled={isScanning}
                      title="Scan on-chain for groups you belong to (may be slow)"
                    >
                      <RefreshCw className={`h-3 w-3 mr-1 ${isScanning ? 'animate-spin' : ''}`} />
                      {isScanning ? 'Scanning...' : 'Refresh'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs text-muted-foreground hover:text-destructive"
                      onClick={clearAllGroups}
                      title="Clear stale group entries from local storage"
                    >
                      Clear All
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {groupIndex.map(entry => (
                  <button
                    key={entry.groupId}
                    onClick={() => setSelectedGroupId(entry.groupId)}
                    className={`w-full text-left p-3 rounded-lg transition-all ${
                      selectedGroupId === entry.groupId ? 'bg-primary/20 border-primary/40' : 'bg-muted/30 hover:bg-muted/50'
                    } border`}
                  >
                    <h3 className="font-medium">{entry.name}</h3>
                    <p className="text-sm text-muted-foreground">{formatAddress(entry.creator)}</p>
                  </button>
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-2 space-y-6">
            {isLoadingDetail && (
              <Card className="bg-gradient-card backdrop-blur-sm border-primary/20 shadow-card">
                <CardContent className="py-8 text-center text-muted-foreground">
                  <RefreshCw className="h-5 w-5 mr-2 inline animate-spin" />
                  Loading on-chain data...
                </CardContent>
              </Card>
            )}

            {!isLoadingDetail && onChainGroup && (
              <>
                <Card className="bg-gradient-card backdrop-blur-sm border-primary/20 shadow-card">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>{selectedIndexEntry?.name ?? 'Group'}</CardTitle>
                        <CardDescription>{selectedIndexEntry?.description}</CardDescription>
                      </div>
                      <Dialog open={isAddExpenseOpen} onOpenChange={setIsAddExpenseOpen}>
                        <DialogTrigger asChild>
                          <Button variant="hero">
                            <Plus className="h-4 w-4 mr-2" />
                            Add Expense
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="bg-gradient-card backdrop-blur-sm border-primary/20">
                          <DialogHeader>
                            <DialogTitle>Add New Expense</DialogTitle>
                            <DialogDescription>
                              Recorded on-chain. Select who paid for this expense.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div>
                              <Label htmlFor="description">Description *</Label>
                              <Input
                                id="description"
                                placeholder="e.g., Dinner at restaurant"
                                value={expenseDescription}
                                onChange={e => setExpenseDescription(e.target.value)}
                              />
                            </div>
                            <div>
                              <Label htmlFor="amount">Amount (₹) *</Label>
                              <Input
                                id="amount"
                                type="number"
                                step="1"
                                min="1"
                                placeholder="0"
                                value={expenseAmount}
                                onChange={e => setExpenseAmount(e.target.value)}
                              />
                            </div>
                            <div>
                              <Label htmlFor="paidBy">Paid By *</Label>
                              <select
                                id="paidBy"
                                value={expensePaidBy}
                                onChange={e => setExpensePaidBy(e.target.value)}
                                className="w-full mt-1 px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                              >
                                <option value="">Select who paid...</option>
                                {onChainGroup?.members.map(member => {
                                  const addr = member.toString();
                                  return (
                                    <option key={addr} value={addr}>
                                      {addr === publicKey?.toString() ? `You (${addr.slice(0, 6)}...)` : `${addr.slice(0, 6)}...${addr.slice(-4)}`}
                                    </option>
                                  );
                                })}
                              </select>
                            </div>
                            <Button
                              onClick={handleAddExpense}
                              disabled={isSubmittingExpense}
                              className="w-full"
                              variant="hero"
                            >
                              {isSubmittingExpense ? 'Submitting...' : 'Add Expense'}
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </CardHeader>
                </Card>

                <Card className="bg-gradient-card backdrop-blur-sm border-primary/20 shadow-card">
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <TrendingUp className="h-5 w-5 mr-2" />
                      Balances
                    </CardTitle>
                    <CardDescription>
                      Computed on-chain from actual recorded spend, not an even split
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {onChainGroup.balances.map(b => {
                        const owedInr = b.owed.toNumber() / 100; // paise -> INR
                        const memberStr = b.member.toString();
                        return (
                          <div key={memberStr} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                            <span className="font-medium">
                              {memberStr === publicKey?.toString() ? 'You' : formatAddress(memberStr)}
                            </span>
                            <span
                              className={`font-bold ${
                                owedInr > 0 ? 'text-green-500' : owedInr < 0 ? 'text-red-500' : 'text-muted-foreground'
                              }`}
                            >
                              {owedInr > 0 ? '+' : ''}
                              ₹{Math.abs(owedInr).toFixed(2)}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {settlements.length > 0 && (
                      <div className="mt-6">
                        <h4 className="font-medium mb-3 flex items-center">
                          <TrendingDown className="h-4 w-4 mr-2" />
                          Suggested Settlements
                        </h4>
                        <p className="text-xs text-muted-foreground mb-3">
                          These are suggestions only — settling still happens off-chain for now.
                        </p>
                        <div className="space-y-2">
                          {settlements.map((s, i) => (
                            <div key={i} className="p-3 bg-accent/30 rounded-lg text-sm flex items-center justify-between">
                              <div>
                                <span className="font-medium">
                                  {s.from === publicKey?.toString() ? 'You owe' : formatAddress(s.from) + ' owes'}
                                </span>{' '}
                                <span className="font-bold text-primary">₹{s.amount.toFixed(2)}</span>{' '}
                                <span>to {s.to === publicKey?.toString() ? 'you' : formatAddress(s.to)}</span>
                              </div>
                              {s.from === publicKey?.toString() && (
                                <Button size="sm" onClick={() => handleSettle(s.from, s.to, s.amount)}>
                                  Settle
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="bg-gradient-card backdrop-blur-sm border-primary/20 shadow-card">
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Receipt className="h-5 w-5 mr-2" />
                      Expenses
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {expenses.length === 0 ? (
                      <p className="text-muted-foreground text-center py-8">
                        No expenses yet. Add your first expense to get started!
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {expenses
                          .slice()
                          .reverse()
                          .map(expense => (
                            <div key={expense.expenseId.toString()} className="p-4 bg-muted/30 rounded-lg">
                              <div className="flex items-center justify-between mb-2">
                                <h4 className="font-medium">{expense.description}</h4>
                                <span className="font-bold text-lg">
                                  ₹{(expense.amount.toNumber() / 100).toFixed(2)}
                                </span>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                Paid by:{' '}
                                {expense.payer.toString() === publicKey?.toString() ? 'You' : formatAddress(expense.payer.toString())}
                              </p>
                            </div>
                          ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};