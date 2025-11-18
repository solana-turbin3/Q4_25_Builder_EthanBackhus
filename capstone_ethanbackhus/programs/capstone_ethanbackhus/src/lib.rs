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
        uuid: [u8; 16],
        merchant_id: String,
        amount: u64,
        reference_id: String,
        fiat_currencty: String,
        merchant_bank: String,
    ) -> Result<()> {
        ctx.accounts.initialize(uuid, merchant_id, amount, reference_id, fiat_currencty, merchant_bank, &ctx.bumps)?;
        Ok(())
    }

    pub fn deposit_stablecoin(
        ctx: Context<DepositStablecoin>
    ) -> Result<()> {
        ctx.accounts.deposit_stablecoin()?;
        Ok(())
    }

    pub fn refund_payment(
        ctx: Context<RefundPayment>,
    ) -> Result<()> {
        ctx.accounts.refund_payment()?;
        Ok(())
    }

    pub fn mark_payment_settled(
        ctx: Context<MarkPaymentSettled>,
    ) -> Result<()> {
        ctx.accounts.mark_payment_settled()?;
        Ok(())
    }
}
