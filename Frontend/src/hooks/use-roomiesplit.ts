import { useRoomieProgram, getGroupPDA, getExpensePDA } from '@/lib/anchor-client';
import { useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, SystemProgram } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import { useToast } from './use-toast';

export interface OnChainGroup {
  creator: PublicKey;
  members: PublicKey[];
  totalExpenses: BN;
  expenseCount: BN;
  balances: Array<{
    member: PublicKey;
    owed: BN;
    spent: BN;
  }>;
}

export interface OnChainExpense {
  expenseId: BN;
  group: PublicKey;
  payer: PublicKey;
  amount: BN;
  description: string;
}

export const useRoomiesplit = () => {
  const { program } = useRoomieProgram();
  const { publicKey, signTransaction } = useWallet();
  const { toast } = useToast();

  const createGroup = async (memberAddresses: string[]) => {
    if (!program || !publicKey || !signTransaction) {
      throw new Error('Wallet not connected or program not available');
    }

    try {
      const members = memberAddresses.map(addr => new PublicKey(addr));
      const groupId = new BN(Date.now()).mul(new BN(1000)).add(new BN(Math.floor(Math.random() * 1000)));
      const [groupPDA] = getGroupPDA(publicKey, groupId);

      const tx = await (program as any).methods
        .createGroup(groupId, members)
        .accounts({
          group: groupPDA,
          creator: publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      toast({
        title: "Group Created!",
        description: `Transaction: ${tx.slice(0, 8)}...`,
      });

      return { groupAddress: groupPDA, groupId: groupId.toString(), transaction: tx };
    } catch (error) {
      console.error('Error creating group:', error);
      toast({
        title: "Error",
        description: "Failed to create group on-chain",
        variant: "destructive",
      });
      throw error;
    }
  };

  const addExpense = async (
    groupCreator: PublicKey,
    groupId: BN | number,
    amount: number,
    description: string,
    paidByAddress?: string
  ) => {
    if (!program || !publicKey || !signTransaction) {
      throw new Error('Wallet not connected or program not available');
    }

    try {
      const [groupPDA] = getGroupPDA(groupCreator, groupId);
      
      // Fetch group to get current expense count
      const groupAccount = await (program as any).account.group.fetch(groupPDA) as OnChainGroup;
      const expenseCount = groupAccount.expenseCount.toNumber();
      
      const [expensePDA] = getExpensePDA(groupPDA, expenseCount);

      // Store amount in paise (INR × 100) as the on-chain u64 amount
      const amountPaise = new BN(Math.round(amount * 100));

      // paid_by is an instruction argument — who to credit in balance tracking
      // The connected wallet (publicKey) always signs and pays tx fees
      const paidByPubkey = paidByAddress ? new PublicKey(paidByAddress) : publicKey;

      const tx = await (program as any).methods
        .addExpense(amountPaise, description, paidByPubkey)
        .accounts({
          group: groupPDA,
          expense: expensePDA,
          payer: publicKey,  // always the connected wallet (signer)
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      toast({
        title: "Expense Added!",
        description: `Transaction: ${tx.slice(0, 8)}...`,
      });

      return { expenseAddress: expensePDA, transaction: tx };
    } catch (error) {
      console.error('Error adding expense:', error);
      toast({
        title: "Error",
        description: "Failed to add expense on-chain",
        variant: "destructive",
      });
      throw error;
    }
  };

  const calculateBalances = async (groupCreator: PublicKey, groupId: BN | number) => {
    if (!program || !publicKey) {
      throw new Error('Wallet not connected or program not available');
    }

    try {
      const [groupPDA] = getGroupPDA(groupCreator, groupId);

      const tx = await (program as any).methods
        .calculateBalances()
        .accounts({
          group: groupPDA,
        })
        .rpc();

      toast({
        title: "Balances Updated!",
        description: `Transaction: ${tx.slice(0, 8)}...`,
      });

      return tx;
    } catch (error) {
      console.error('Error calculating balances:', error);
      toast({
        title: "Error",
        description: "Failed to calculate balances",
        variant: "destructive",
      });
      throw error;
    }
  };

  const fetchGroup = async (groupCreator: PublicKey, groupId: BN | number): Promise<OnChainGroup | null> => {
    if (!program) return null;

    try {
      const [groupPDA] = getGroupPDA(groupCreator, groupId);
      const groupAccount = await (program as any).account.group.fetch(groupPDA) as OnChainGroup;
      return groupAccount;
    } catch (error) {
      console.error('Error fetching group:', error);
      return null;
    }
  };

  const fetchExpenses = async (groupCreator: PublicKey, groupId: BN | number): Promise<OnChainExpense[]> => {
    if (!program) return [];

    try {
      const [groupPDA] = getGroupPDA(groupCreator, groupId);
      const groupAccount = await (program as any).account.group.fetch(groupPDA) as OnChainGroup;
      const rawCount = groupAccount.expenseCount.toNumber();

      // Guard against corrupted account data (e.g. accounts created before a
      // struct layout change, where expenseCount reads from the wrong offset
      // and returns a huge garbage number that would loop forever).
      if (rawCount > 1000) {
        console.error(`fetchExpenses: expenseCount=${rawCount} looks corrupted, skipping. This group was likely created with an older program version — recreate it.`);
        return [];
      }

      const expenses: OnChainExpense[] = [];
      for (let i = 0; i < rawCount; i++) {
        try {
          const [expensePDA] = getExpensePDA(groupPDA, i);
          const expenseAccount = await (program as any).account.expense.fetch(expensePDA) as OnChainExpense;
          expenses.push(expenseAccount);
        } catch (error) {
          console.error(`Error fetching expense ${i}:`, error);
        }
      }

      return expenses;
    } catch (error) {
      console.error('Error fetching expenses:', error);
      return [];
    }
  };

  const getUserGroups = async (): Promise<Array<OnChainGroup & { groupPda: PublicKey }>> => {
    if (!program || !publicKey) return [];

    try {
      // No memcmp filter on `members` here — members is a variable-length Vec,
      // so its byte offset isn't fixed and can't be targeted with memcmp.
      // Fetching all groups and filtering client-side is the simplest correct
      // approach at this project's scale (fine for dozens/hundreds of groups;
      // would need an off-chain indexer at real scale).
      const allGroups = await (program as any).account.group.all();

      return allGroups
        .filter((g: any) => g.account.members.some((m: PublicKey) => m.equals(publicKey)))
        .map((g: any) => ({ ...g.account, groupPda: g.publicKey }));
    } catch (error) {
      console.error('Error fetching user groups:', error);
      return [];
    }
  };

  const settleDebt = async (
    groupCreator: PublicKey,
    groupId: BN | number,
    creditor: PublicKey,
    amount: number // same raw unit as the displayed "owed" value — no conversion applied
  ) => {
    if (!program || !publicKey || !signTransaction) {
      throw new Error('Wallet not connected or program not available');
    }

    try {
      const [groupPDA] = getGroupPDA(groupCreator, groupId);
      // We need to multiply by 100 because the on-chain program calculates balances in paise.
      // So if the debt is ₹441.04, we need to add 44104 to the `settled` tracking variable on-chain.
      const amountLamports = new BN(Math.round(amount * 100)); // 1:1 placeholder with paise — NOT a real SOL value, see README/roadmap note

      const tx = await (program as any).methods
        .settleDebt(amountLamports)
        .accounts({
          group: groupPDA,
          debtor: publicKey,
          creditor: creditor,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      toast({ title: "Settled!", description: `Transaction: ${tx.slice(0, 8)}...` });
      return tx;
    } catch (error) {
      console.error('Error settling debt:', error);
      toast({ title: "Error", description: "Failed to settle debt", variant: "destructive" });
      throw error;
    }
  };

  return {
    createGroup,
    addExpense,
    calculateBalances,
    fetchGroup,
    fetchExpenses,
    getUserGroups,
    settleDebt,
  };
};