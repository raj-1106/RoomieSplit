use anchor_lang::prelude::*;

declare_id!("BzEpHaoaEGSQwnFbSv8gVwpxh4tQBn2WS1pDTjUMbc3c"); 

#[program]
pub mod roomiesplit{
    use super::*;

    pub fn create_group(ctx: Context<CreateGroup>, members: Vec<Pubkey>) -> Result<()> {
        let mut members = members;
        require!(members.len() < 5, RoomieError::TooManyMembers); // < 5, not <= 5, since creator adds one more
        members.push(ctx.accounts.creator.key());

        let group = &mut ctx.accounts.group;
        group.creator = ctx.accounts.creator.key();
        group.total_expenses = 0;
        group.expense_count = 0;

        // initialize a zeroed balance entry per member NOW, not in calculate_balances
        group.balances = members
            .iter()
            .map(|m| Balance { member: *m, owed: 0, spent: 0 })
            .collect();

        group.members = members;
        Ok(())
    }

    pub fn add_expense(ctx: Context<AddExpense>, amount: u64, description: String) -> Result<()> {
        require!(description.len() <= 64, RoomieError::DescriptionTooLong); // fixes bug #3
        require!(amount > 0, RoomieError::InvalidAmount);

        let group = &mut ctx.accounts.group;
        let payer_key = ctx.accounts.payer.key();
        require!(group.members.contains(&payer_key), RoomieError::NotMember);

        let expense = &mut ctx.accounts.expense;
        expense.payer = payer_key;
        expense.amount = amount;
        expense.description = description;
        expense.group = group.key();
        expense.expense_id = group.expense_count;

        group.total_expenses = group.total_expenses.checked_add(amount).ok_or(RoomieError::MathOverflow)?;
        group.expense_count = group.expense_count.checked_add(1).ok_or(RoomieError::MathOverflow)?;

        // find this payer's balance entry and credit what they spent
        let balance = group.balances.iter_mut()
            .find(|b| b.member == payer_key)
            .ok_or(RoomieError::NotMember)?;
        balance.spent = balance.spent.checked_add(amount as i64).ok_or(RoomieError::MathOverflow)?;

        Ok(())
    }

    pub fn calculate_balances(ctx: Context<CalculateBalances>) -> Result<()> {
        let group = &mut ctx.accounts.group;
        let member_count = group.members.len() as u64;
        require!(member_count > 0, RoomieError::NoMembers);

        let fair_share = (group.total_expenses / member_count) as i64;

        for balance in group.balances.iter_mut() {
            balance.owed = balance.spent - fair_share; // positive = owed money back, negative = owes money
        }

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
    #[msg("Description too long")]
    DescriptionTooLong,
    #[msg("Math overflow")]
    MathOverflow,
}
