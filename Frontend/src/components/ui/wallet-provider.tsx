import React, { FC, ReactNode, useMemo } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { clusterApiUrl } from '@solana/web3.js';

// Import styles for wallet adapter
import '@solana/wallet-adapter-react-ui/styles.css';

interface WalletProviderProps {
  children: ReactNode;
}

export const SolanaWalletProvider: FC<WalletProviderProps> = ({ children }) => {
  // Using localnet for development — switch to WalletAdapterNetwork.Devnet + clusterApiUrl() for devnet
  const network = WalletAdapterNetwork.Devnet; // kept for wallet adapter compatibility

  // RPC endpoint — points to devnet
  const endpoint = useMemo(() => clusterApiUrl(network), [network]);

  // Wallets that your app supports
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
    ],
    []
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};