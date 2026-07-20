# RoomieSplit 💰

A decentralized expense splitting app for roommates and groups, built on Solana (Anchor/Rust). Group membership, expenses, balance calculation, and settlement are all on-chain.

## 🚀 Features

- **On-chain Group Management**: Create expense groups on Solana; supports multiple groups per wallet (each group has a unique on-chain ID)
- **On-chain Expense Tracking**: Each expense is its own account, tied to the group and to whoever actually paid — only group members can record expenses, and only for other group members
- **Real Balance Calculation**: Net balances are computed from actual per-member spend vs. fair share, with correct handling of amounts that don't divide evenly across members
- **On-chain Settlement**: Members can settle debts directly — a real SOL transfer between wallets, recorded on-chain, and reflected in every future balance calculation
- **Wallet Integration**: Connect with Phantom and other Solana wallets via the Wallet Adapter ecosystem
- **Tested**: Program logic covered by an Anchor test suite that verifies both correct behavior and specific on-chain error conditions

## 🛠️ Tech Stack

**Frontend**: React 18, TypeScript, Vite, React Router, TanStack Query, Tailwind CSS + shadcn/ui, React Hook Form + Zod

**Blockchain**: Solana, Anchor Framework (0.31.1), `@coral-xyz/anchor`, Solana Wallet Adapter

## 📦 Installation

```bash
git clone <your-repo-url>
npm install
npm run dev
```

## 🎯 Usage

1. **Connect Wallet**: Connect a Solana wallet (Phantom recommended)
2. **Create Group**: Add roommates' wallet addresses — creates a group account on-chain
3. **Add Expenses**: Record shared expenses; only group members can add them, and only for other members of the same group
4. **Calculate Balances**: Computes each member's net position on-chain — actual spend minus fair share, remainder-safe
5. **Settle Up**: Pay a debt directly through the app — moves real SOL from debtor to creditor and records the settlement on-chain, so it's reflected in every future balance calculation

## 🌐 Live Demo

[RoomieSplit App](https://roomiesplit1.netlify.app/)

## 🧱 What's on-chain

Every core piece of this app's logic lives in the Solana program, not a database:

- Groups and expenses are PDAs (program-derived accounts)
- `calculate_balances` computes real net positions per member, splitting any remainder fairly instead of losing it to integer division
- `add_expense` requires the transaction signer to be an actual group member — outsiders can't write fake entries into a group's ledger
- `settle_debt` performs a real on-chain SOL transfer and permanently records the settlement, so balances stay correct across future expenses rather than resetting

## ⚠️ Known limitation

Settlement amounts are currently a 1:1 placeholder scale, not pegged to a real INR/SOL exchange rate — the mechanism (real transfer, on-chain record, correctly folded into future balance math) is fully working and tested, but the actual conversion rate between displayed currency and SOL moved is not yet implemented.

Also: the dashboard currently only surfaces groups where the connected wallet is the *creator* — a wallet added as a member to someone else's group has no way to view it yet.

## 🛠️ Development notes

Built and tested against Anchor 0.31.1 / Solana CLI. Confirm your local Anchor CLI version matches what's pinned in `Anchor.toml` before running `anchor build` — version mismatches between Anchor CLI and the `anchor-lang`/`anchor-spl` crate versions are a common source of confusing build failures on this stack. Any change to an instruction's arguments requires rebuilding, redeploying, and copying the fresh IDL into the frontend — the client and program can silently disagree otherwise.