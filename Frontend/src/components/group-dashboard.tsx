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

// Local index of which on-chain groups this user created — localStorage here
// only stores enough to know WHICH group PDAs to fetch, not the group's actual
// data. All balances, expenses, and member lists come from the chain, fetched
// fresh each time. Note: this only surfaces groups the connected wallet
// CREATED, not groups they were added to as a member — getUserGroups() filters
// by the creator field, so a member-only view would need a separate lookup.
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
  const { addExpense: addExpenseOnChain, calculateBalances: calculateBalancesOnChain, fetchGroup, fetchExpenses } = useRoomiesplit();

  const [groupIndex, setGroupIndex] = useState<GroupIndexEntry[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [onChainGroup, setOnChainGroup] = useState<OnChainGroup | null>(null);
  const [expenses, setExpenses] = useState<OnChainExpense[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);

  const [expenseDescription, setExpenseDescription] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expensePaidBy, setExpensePaidBy] = useState<string>('');
  const [isSubmittingExpense, setIsSubmittingExpense] = useState(false);

  useEffect(() => {
    if (connected) {
      const savedIndex = JSON.parse(localStorage.getItem('groupIndex') || '[]') as GroupIndexEntry[];
      setGroupIndex(savedIndex);
      if (savedIndex.length > 0 && !selectedGroupId) {
        setSelectedGroupId(savedIndex[0].groupId);
      }
    }
  }, [connected]);

  useEffect(() => {
    if (selectedGroupId) {
      const entry = groupIndex.find(g => g.groupId === selectedGroupId);
      if (entry) {
        loadGroupData(entry.creator, entry.groupId);
      }
    }
  }, [selectedGroupId, groupIndex]);

  const loadGroupData = async (creatorAddress: string, groupId: string) => {
    setIsLoading(true);
    try {
      const creatorPk = new PublicKey(creatorAddress);
      const [group, groupExpenses] = await Promise.all([
        fetchGroup(creatorPk, groupId),
        fetchExpenses(creatorPk, groupId),
      ]);
      setOnChainGroup(group);
      setExpenses(groupExpenses);
    } catch (error) {
      console.error('Error loading group data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load group data from chain',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
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
            <CardTitle>No Groups Found</CardTitle>
            <CardDescription>
              You haven't created any on-chain groups yet. Note: this dashboard only shows groups
              you created — groups you were added to as a member aren't listed here yet.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="hero" onClick={() => navigate('/create-group')} className="w-full">
              Create Your First Group
            </Button>
          </CardContent>
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
                <CardTitle className="flex items-center">
                  <Users className="h-5 w-5 mr-2" />
                  Your Groups
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
            {isLoading && (
              <Card className="bg-gradient-card backdrop-blur-sm border-primary/20 shadow-card">
                <CardContent className="py-8 text-center text-muted-foreground">
                  <RefreshCw className="h-5 w-5 mr-2 inline animate-spin" />
                  Loading on-chain data...
                </CardContent>
              </Card>
            )}

            {!isLoading && onChainGroup && (
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
                            <div key={i} className="p-3 bg-accent/30 rounded-lg text-sm">
                              <span className="font-medium">
                                {s.from === publicKey?.toString() ? 'You owe' : formatAddress(s.from) + ' owes'}
                              </span>{' '}
                              <span className="font-bold text-primary">₹{s.amount.toFixed(2)}</span>{' '}
                              <span>to {s.to === publicKey?.toString() ? 'you' : formatAddress(s.to)}</span>
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