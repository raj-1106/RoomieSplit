use anchor_lang::prelude::*;

declare_id!("BzEpHaoaEGSQwnFbSv8gVwpxh4tQBn2WS1pDTjUMbc3c"); 

#[program]
pub mod roomiesplit{
    use super::*;

    pub fn create_group(ctx: Context<CreateGroup>, group_id: u64, members: Vec<Pubkey>) -> Result<()> {
        let mut members = members;
        require!(members.len() < 5, RoomieError::TooManyMembers); // < 5, not <= 5, since creator adds one more
        members.push(ctx.accounts.creator.key());

        let group = &mut ctx.accounts.group;
        group.group_id = group_id;
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

    pub fn add_expense(ctx: Context<AddExpense>, amount: u64, description: String, paid_by: Pubkey) -> Result<()> {
        require!(description.len() <= 64, RoomieError::DescriptionTooLong);
        require!(amount > 0, RoomieError::InvalidAmount);

        let group = &mut ctx.accounts.group;

        // paid_by must be a member of the group
        require!(group.members.contains(&paid_by), RoomieError::NotMember);

        let expense = &mut ctx.accounts.expense;
        expense.payer = paid_by;  // record who actually paid (for balance tracking)
        expense.amount = amount;
        expense.description = description;
        expense.group = group.key();
        expense.expense_id = group.expense_count;

        group.total_expenses = group.total_expenses.checked_add(amount).ok_or(RoomieError::MathOverflow)?;
        group.expense_count = group.expense_count.checked_add(1).ok_or(RoomieError::MathOverflow)?;

        // credit the member who paid (not necessarily the tx signer)
        let balance = group.balances.iter_mut()
            .find(|b| b.member == paid_by)
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
#[instruction(group_id: u64)]
pub struct CreateGroup<'info> {
    #[account(
        init,
        payer = creator,
        space = 8 + Group::MAX_SIZE,
        seeds = [b"group", creator.key().as_ref(), &group_id.to_le_bytes()],
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
        seeds = [b"group", group.creator.as_ref(), &group.group_id.to_le_bytes()],
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
        seeds = [b"group", group.creator.as_ref(), &group.group_id.to_le_bytes()],
        bump
    )]
    pub group: Account<'info, Group>,
}

#[account]
pub struct Group {
    pub group_id: u64,
    pub creator: Pubkey,
    pub members: Vec<Pubkey>,
    pub total_expenses: u64,
    pub expense_count: u64,
    pub balances: Vec<Balance>,
}

impl Group {
    pub const MAX_SIZE: usize = 8 // group_id
        + 32 //creator
        + 4 + (32 * 5) // members (4 bytes for len prefix)
        + 8 // total_expenses
        + 8 // expense_count
        + 4 + (5 * Balance::MAX_SIZE); // balances (4 bytes for len prefix)
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
