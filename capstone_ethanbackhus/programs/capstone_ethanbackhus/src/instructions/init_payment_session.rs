use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{Mint, Token, TokenAccount},
};

use crate::state::payment_session::{PaymentSession, PaymentSessionStatus};

#[derive(Accounts)]
pub struct InitPaymentSession<'info> {

    #[account(mut)]
    pub payer: Signer<'info>,

    pub mint: Account<'info, Mint>,

    #[account(
        init,
        payer = payer,
        space = PaymentSession::DISCRIMINATOR.len() + PaymentSession::INIT_SPACE,
        seeds = [b"payment_session", payer.key().as_ref()],
        bump
    )]
    pub payment_session: Account<'info, PaymentSession>,

    #[account(
        init_if_needed,
        payer = signer,
        associated_token::mint = mint,
        associated_token::authority = payment_session
    )]
    pub escrow_ata: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>
}

impl<'info> InitPaymentSession<'info> {
    pub fn init_payment_session(&mut self) -> Result<()> {
        self.payment_session.set_inner(PaymentSession {
            payer: self.payer.key(),
            merchant_id: String::from(""), // to be set later
            amount: 0,                     // to be set later
            token_mint: self.mint.key(),
            escrow_ata: self.escrow_ata.key(),
            status: PaymentSessionStatus::Initialized,
            expiry_ts: 0,                  // to be set later
            bump: self.payment_session.bump(),
            reference_id: String::from(""), // to be set later
            settlement_authority: Pubkey::default(), // to be set later
        }

        );

        Ok(())
    }
}