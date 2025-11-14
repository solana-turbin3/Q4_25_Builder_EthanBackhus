use anchor_lang::prelude::*;
use anchor_spl::token::TokenAccount;

mod instructions;
mod state;
mod errors;

use instructions::*;
use state::*;

declare_id!("DDR17KNMbiT9pFnncgeyLeLz6UXSnbBrwvwxzUDwLrV6");

#[program]
pub mod capstone_ethanbackhus {

    use super::*;

    pub fn init_payment_session(
        ctx: Context<InitPaymentSession>,
        uuid: [u8; 16], // take uuid as an input from the client
        merchant_id: String,
        amount: u64,
        reference_id: String,
        settlement_authority: Pubkey,
    ) -> Result<()> {
        ctx.accounts.initialize(uuid, merchant_id, amount, reference_id, settlement_authority, &ctx.bumps)?;
        Ok(())
    }

    pub fn deposit_stablecoin(
        ctx: Context<DepositStablecoin>,
        uuid: [u8; 16]
    ) -> Result<()> {
        ctx.accounts.deposit_stablecoin(uuid)?;
        Ok(())
    }

    pub fn refund_payment(
        ctx: Context<RefundPayment>,
        uuid: [u8; 16]
    ) -> Result<()> {
        ctx.accounts.refund_payment(uuid)?;
        Ok(())
    }

    pub fn mark_payment_settled(
        ctx: Context<MarkPaymentSettled>,
        uuid: [u8; 16]
    ) -> Result<()> {
        ctx.accounts.mark_payment_settled(uuid)?;
        Ok(())
    }
}
