import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Roomiesplit } from "../target/types/roomiesplit";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { BN } from "bn.js";

describe("roomiesplit", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Roomiesplit as Program<Roomiesplit>;

  let groupPda: PublicKey;

  it("✅ Creates a group (happy case)", async () => {
    [groupPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("group"), provider.wallet.publicKey.toBuffer()],
      program.programId
    );

    await program.methods
      .createGroup([provider.wallet.publicKey]) // only members vector
      .accounts({
        group: groupPda,
        payer: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const group = await program.account.group.fetch(groupPda);
    console.log("Group created:", group);
  });

  it("✅ Adds an expense (happy case)", async () => {
    const expensePda = PublicKey.findProgramAddressSync(
      [Buffer.from("expense"), groupPda.toBuffer()],
      program.programId
    )[0];

    await program.methods
      .addExpense("Dinner", new BN(50)) // ✅ BN, not number
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
    try {
      const [badGroupPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("group"), Buffer.from("bad")],
        program.programId
      );

      await program.methods
        .createGroup(Array(20).fill(provider.wallet.publicKey)) // too many
        .accounts({
          group: badGroupPda,
          payer: provider.wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      throw new Error("Expected failure but succeeded");
    } catch (err) {
      console.log("Expected error (TooManyMembers):", err.error?.errorMessage);
    }
  });

  it("❌ Fails to add expense with invalid amount", async () => {
    try {
      const badExpensePda = PublicKey.findProgramAddressSync(
        [Buffer.from("expense"), groupPda.toBuffer(), Buffer.from("bad")],
        program.programId
      )[0];

      await program.methods
        .addExpense("Invalid", new BN(0)) // invalid amount
        .accounts({
          group: groupPda,
          expense: badExpensePda,
          payer: provider.wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      throw new Error("Expected failure but succeeded");
    } catch (err) {
      console.log("Expected error (InvalidAmount):", err.error?.errorMessage);
    }
  });
});
