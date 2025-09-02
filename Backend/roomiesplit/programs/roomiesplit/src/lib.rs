use anchor_lang::prelude::*;

declare_id!("CFTz6LKRNHgWJhYqPvQFYVjYAiCnkdLbK2KM5FDoUgPg"); 

#[program]
pub mod roomiesplit {
    use super::*;

    pub fn create_group(ctx: Context<CreateGroup>, members: Vec<Pubkey>) -> Result<()> {
        let group = &mut ctx.accounts.group;

        require!(
            members.len() <= 5,
            RoomieError::TooManyMembers
        );

        group.creator = ctx.accounts.creator.key();
        group.members = members;
        group.members.push(ctx.accounts.creator.key()); // include creator
        group.total_expenses = 0;
        group.expense_count = 0;
        Ok(())
    }

    pub fn add_expense(ctx: Context<AddExpense>, amount: u64, description: String) -> Result<()> {
        let group = &mut ctx.accounts.group;

        // only members can add
        require!(
            group.members.contains(&ctx.accounts.payer.key()),
            RoomieError::NotMember
        );

        require!(amount > 0, RoomieError::InvalidAmount);

        let expense = &mut ctx.accounts.expense;
        expense.payer = ctx.accounts.payer.key();
        expense.amount = amount;
        expense.description = description;
        expense.group = group.key();
        expense.expense_id = group.expense_count;

        group.total_expenses = group.total_expenses.checked_add(amount).unwrap();
        group.expense_count = group.expense_count.checked_add(1).unwrap();

        Ok(())
    }

    pub fn calculate_balances(ctx: Context<CalculateBalances>) -> Result<()> {
        let group = &mut ctx.accounts.group;

        let member_count = group.members.len() as u64;
        require!(member_count > 0, RoomieError::NoMembers);

        let fair_share = group.total_expenses / member_count;

        // Collect balances in a temporary vector
        let mut new_balances: Vec<Balance> = Vec::new();
            for member in group.members.iter() {
            new_balances.push(Balance {
            member: *member,
            owed: fair_share as i64,
            spent: 0,
        });
    }

    // Now assign (only one mutable borrow here)
    group.balances = new_balances;

    Ok(())
    }   
}

#[derive(Accounts)]
pub struct CreateGroup<'info> {
    #[account(
        init,
        payer = creator,
        space = 8 + Group::MAX_SIZE,
        seeds = [b"group", creator.key().as_ref()],
        bump
    )]
    pub group: Account<'info, Group>,

    #[account(mut)]
    pub creator: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AddExpense<'info> {
    #[account(
        mut,
        seeds = [b"group", group.creator.as_ref()],
        bump
    )]
    pub group: Account<'info, Group>,

    #[account(
        init,
        payer = payer,
        space = 8 + Expense::MAX_SIZE,
        seeds = [b"expense", group.key().as_ref(), &group.expense_count.to_le_bytes()],
        bump
    )]
    pub expense: Account<'info, Expense>,

    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CalculateBalances<'info> {
    #[account(
        mut,
        seeds = [b"group", group.creator.as_ref()],
        bump
    )]
    pub group: Account<'info, Group>,
}

#[account]
pub struct Group {
    pub creator: Pubkey,
    pub members: Vec<Pubkey>,
    pub total_expenses: u64,
    pub expense_count: u64,
    pub balances: Vec<Balance>,
}

impl Group {
    pub const MAX_SIZE: usize = 32 // creator
        + (32 * 5) // members
        + 8 // total_expenses
        + 8 // expense_count
        + (5 * Balance::MAX_SIZE); // balances
}

#[account]
pub struct Expense {
    pub expense_id: u64,
    pub group: Pubkey,
    pub payer: Pubkey,
    pub amount: u64,
    pub description: String,
}

impl Expense {
    pub const MAX_SIZE: usize = 8 + 32 + 32 + 8 + 64; // description max 64 chars
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct Balance {
    pub member: Pubkey,
    pub owed: i64,
    pub spent: i64,
}

impl Balance {
    pub const MAX_SIZE: usize = 32 + 8 + 8;
}

#[error_code]
pub enum RoomieError {
    #[msg("Too many members in group")]
    TooManyMembers,
    #[msg("User is not a member of this group")]
    NotMember,
    #[msg("Invalid expense amount")]
    InvalidAmount,
    #[msg("Group has no members")]
    NoMembers,
}
