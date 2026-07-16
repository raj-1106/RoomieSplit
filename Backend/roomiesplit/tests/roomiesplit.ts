import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Roomiesplit } from "../target/types/roomiesplit";
import { PublicKey, SystemProgram, Keypair } from "@solana/web3.js";
import { BN } from "bn.js";
import { assert } from "chai";

describe("roomiesplit", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Roomiesplit as Program<Roomiesplit>;

  let groupPda: PublicKey;

  it("✅ Creates a group (happy case)", async () => {
    const groupId = new BN(1);
    [groupPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("group"), provider.wallet.publicKey.toBuffer(), groupId.toArrayLike(Buffer, "le", 8)],
      program.programId
    );

    await program.methods
      .createGroup(groupId, [provider.wallet.publicKey])
      .accounts({
        group: groupPda,
        creator: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const group = await program.account.group.fetch(groupPda);
    console.log("Group created:", group);
  });

  it("✅ Adds an expense (happy case)", async () => {
    const expensePda = PublicKey.findProgramAddressSync(
      [Buffer.from("expense"), groupPda.toBuffer(), new BN(0).toArrayLike(Buffer, "le", 8)],
      program.programId
    )[0];

    await program.methods
      .addExpense(new BN(50), "Dinner" ) // ✅ BN, not number
      .accounts({
        group: groupPda,
        expense: expensePda,
        payer: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const expense = await program.account.expense.fetch(expensePda);
    console.log("Expense added:", expense);
  });

  it("❌ Fails to create group with too many members", async () => {
    const badCreator = Keypair.generate();
    const sig = await provider.connection.requestAirdrop(
      badCreator.publicKey,
      anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(sig, "confirmed");

    const groupId = new BN(2);
    const [badGroupPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("group"), badCreator.publicKey.toBuffer(), groupId.toArrayLike(Buffer, "le", 8)],
      program.programId
    );

    try {
      await program.methods
        .createGroup(groupId, Array(20).fill(provider.wallet.publicKey))
        .accounts({
          group: badGroupPda,
          creator: badCreator.publicKey, // correct field name, matches Rust
          systemProgram: SystemProgram.programId,
        })
        .signers([badCreator]) // this keypair actually signs
        .rpc();

      assert.fail("Expected transaction to throw TooManyMembers");
    } catch (err) {
      console.log("Full Error:", err.toString());
      assert.include(err.toString(), "TooManyMembers");
    }
  });

  it("❌ Fails to add expense with invalid amount", async () => {
    const groupAccount = await program.account.group.fetch(groupPda);
    const expenseCountBuf = groupAccount.expenseCount.toArrayLike(Buffer, "le", 8); // was hardcoded to 0
    const badExpensePda = PublicKey.findProgramAddressSync(
      [Buffer.from("expense"), groupPda.toBuffer(), expenseCountBuf],
      program.programId
    )[0];
    try {
      await program.methods
        .addExpense(new BN(0), "Invalid")
        .accounts({
          group: groupPda,
          expense: badExpensePda,
          payer: provider.wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      assert.fail("Expected failure to throw InvalidAmount");
    } catch (err) {
      console.log("Full Error:", err.toString());
      assert.include(err.toString(), "InvalidAmount");
    }
  });
});
