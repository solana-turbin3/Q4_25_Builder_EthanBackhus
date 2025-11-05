use anchor_lang::prelude::*;

mod instructions;
mod state;

use instructions::*;
use state::*;

declare_id!("3mmGkqMXHZ878yp9UpPos48FLa4HNPEKkZtHhkZemrrd");

use crate::instruction::InitPaymentSession;

#[program]
pub mod capstone_ethanbackhus {

    use super::*;

    pub fn init_payment_session(
        ctx: Context<InitPaymentSession>,
        merchant_id: String,
        amount: u64,
        expiry_ts: i64,
        created_ts: i64,
        reference_id: String,
        settlement_authority: Pubkey,
    ) -> Result<()> {
        ctx.accounts.initialize(merchant_id, amount, expiry_ts, reference_id, settlement_authority, &ctx.bumps)?;
        Ok(())
    }
}
