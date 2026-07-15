# RoomieSplit 💰

A decentralized expense splitting app for roommates and groups, built on Solana (Anchor/Rust). Group membership, expenses, and balance calculations are stored and computed on-chain.

## 🚀 Features

- **On-chain Group Management**: Create expense groups on Solana, with member lists stored in a program-derived account (PDA)
- **On-chain Expense Tracking**: Each expense is recorded as its own account, tied to the group and payer
- **Real Balance Calculation**: Net balances are computed from actual per-member spend vs. fair share — not the same number shown to everyone regardless of who paid
- **Wallet Integration**: Connect with Phantom and other Solana wallets via the Wallet Adapter ecosystem
- **Tested**: Program logic covered by an Anchor test suite that verifies both the happy path and specific on-chain error conditions (not just "something failed")

## 🛠️ Tech Stack

**Frontend**: React 18, TypeScript, Vite, React Router, TanStack Query, Tailwind CSS + shadcn/ui, React Hook Form + Zod

**Blockchain**: Solana, Anchor Framework (0.31.1), `@coral-xyz/anchor`, Solana Wallet Adapter

## 📦 Installation

```bash
# Clone the repository
git clone <your-repo-url>

# Install dependencies
npm install

# Start development server
npm run dev
```

## 🎯 Usage

1. **Connect Wallet**: Connect a Solana wallet (Phantom recommended)
2. **Create Group**: Add roommates' wallet addresses — this creates a group account on-chain
3. **Add Expenses**: Record shared expenses; each one is stored as an on-chain account tied to who paid
4. **Calculate Balances**: Triggers on-chain computation of each member's net position (amount they paid minus their fair share)
5. **Settle Up**: Balances show who owes whom — settlement itself currently happens off-chain (see Roadmap)

## 🌐 Live Demo

[RoomieSplit App](https://roomie-split.netlify.app/)

## 🧱 What's actually on-chain today

Group creation, expense recording, and balance calculation are real on-chain program logic — not a UI wrapper over a database. Specifically:

- Groups and expenses are PDAs (program-derived accounts), not rows in a centralized DB
- `calculate_balances` computes each member's net position from their actual recorded spend, not a flat even split
- The program has test coverage for both correct behavior and specific failure conditions (too many members, invalid expense amounts)

## 🗺️ Roadmap — what's not there yet

Being direct about the current limitation: balances are calculated on-chain, but **settling them isn't** — right now "Settle Up" is informational only, and members still have to pay each other outside the app. The next milestone is escrow-based settlement: locking funds when an expense is added and releasing them programmatically on settlement, so the app is actually moving money, not just tracking who owes what. Until that's built, the honest framing is "on-chain expense ledger," not "trustless settlement."

## 🛠️ Development notes

Built and tested against Anchor 0.31.1 / Solana CLI. If cloning fresh, confirm your local Anchor CLI version matches what's pinned in `Anchor.toml` before running `anchor build` — version mismatches between Anchor CLI and the `anchor-lang`/`anchor-spl` crate versions are a common source of confusing build failures on this stack.