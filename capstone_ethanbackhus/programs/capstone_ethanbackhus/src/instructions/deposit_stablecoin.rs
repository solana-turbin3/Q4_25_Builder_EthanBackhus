use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::{AssociatedToken, create},
    token::{Mint, Token, TokenAccount},
};

use crate::state::payment_session::{PaymentSession, PaymentSessionStatus};


#[derive(Accounts)]
#[instruction(merchant_id: String, amount: u64, expiry_ts: i64, reference_id: String, settlement_authority: Pubkey)]
pub struct DepositStablecoin<'info> {

    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        mut,
    )]
    pub payment_session: Account<'info, PaymentSession>,

    #[account(mut)]
    /// CHECK: will be created via CPI
    pub escrow_ata: UncheckedAccount<'info>,

    pub token_mint: Account<'info, Mint>,    // change to USDG?

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>
}

impl<'info> DepositStablecoin <'info> {
    pub fn deposit_stablecoin(
        &mut self,
        uuid: [u8; 16]
    ) -> Result<()> {

        // derive the seeds of the escrow_ata
        let seeds = &[
            b"payment_session",
            self.payer.key().as_ref(),
            &uuid,
            &[self.payment_session.bump]
        ];

        // execute token transfer from payer_ata to escrow_ata
        // update PDA session status to funded
        // emit PaymentSession created event
        // then webhook will detect event

        Ok(())
    }
}

