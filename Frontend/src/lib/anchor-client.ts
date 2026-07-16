import { AnchorProvider, Program, setProvider, BN } from '@coral-xyz/anchor';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, SystemProgram } from '@solana/web3.js';
import { useMemo } from 'react';
import { Buffer } from 'buffer';
import { IDL } from './idl';

// Ensure Buffer is available globally for Anchor
if (typeof window !== 'undefined') {
  (window as any).Buffer = Buffer;
}

// Your deployed program ID
const PROGRAM_ID = new PublicKey('BzEpHaoaEGSQwnFbSv8gVwpxh4tQBn2WS1pDTjUMbc3c');

export function useRoomieProgram() {
  const { connection } = useConnection();
  const wallet = useWallet();

  const provider = useMemo(() => {
    if (!wallet.publicKey || !wallet.signTransaction || !wallet.signAllTransactions) {
      return null;
    }

    return new AnchorProvider(
      connection,
      {
        publicKey: wallet.publicKey,
        signTransaction: wallet.signTransaction,
        signAllTransactions: wallet.signAllTransactions,
      } as any,
      { commitment: 'confirmed' }
    );
  }, [connection, wallet]);

  const program = useMemo(() => {
    if (!provider) return null;

    try {
      setProvider(provider);
      return new Program(IDL, provider);
    } catch (error) {
      console.error('Error creating Anchor program:', error);
      return null;
    }
  }, [provider]);

  return { program, provider };
}

export const getGroupPDA = (creator: PublicKey, groupId: BN | number) => {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('group'), creator.toBuffer(), new BN(groupId).toArrayLike(Buffer, 'le', 8)],
    PROGRAM_ID
  );
};

/**
 * Derives the expense PDA for a given group and expense count.
 *
 * IMPORTANT: expenseCount must be encoded as the raw 8-byte little-endian
 * representation of the u64, matching Rust's `expense_count.to_le_bytes()`
 * on the program side. Encoding it as a padded ASCII string (e.g. "00000001")
 * produces a completely different byte sequence and will cause every call
 * to fail with a ConstraintSeeds error, since the derived PDA won't match
 * what the program expects.
 */
export const getExpensePDA = (groupKey: PublicKey, expenseCount: number) => {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from('expense'),
      groupKey.toBuffer(),
      new BN(expenseCount).toArrayLike(Buffer, 'le', 8),
    ],
    PROGRAM_ID
  );
};

export { PROGRAM_ID };