use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::{AssociatedToken, create},
    token::{Mint, Token, TokenAccount},
};

use crate::state::payment_session::{PaymentSession, PaymentSessionStatus};

#[derive(Accounts)]
#[instruction(uuid: [u8; 16])]  // using UUID as unique seed?
pub struct InitPaymentSession<'info> {

    #[account(mut)]
    pub payer: Signer<'info>,

    pub token_mint: Account<'info, Mint>,    // change to USDG?

    #[account(
        init,
        payer = payer,
        space = PaymentSession::DISCRIMINATOR.len() + PaymentSession::INIT_SPACE,
        seeds = [b"payment_session", payer.key().as_ref(), uuid.as_ref()],
        bump
    )]
    pub payment_session: Account<'info, PaymentSession>,

    #[account(mut)]
    /// CHECK: will be created via CPI
    pub escrow_ata: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>
}

impl<'info> InitPaymentSession<'info> {
        pub fn initialize(
        &mut self,
        merchant_id: String,
        amount: u64,
        expiry_ts: i64,
        reference_id: String,
        settlement_authority: Pubkey,
        bumps: &InitPaymentSessionBumps,
    ) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;

        // Get bump for PDA
        //let bump = ctx.bumps.payment_session;

        // Create escrow ATA via CPI (owned by payment_session PDA)
        create(
            CpiContext::new(
                self.associated_token_program.to_account_info(),
                anchor_spl::associated_token::Create {
                    payer: self.payer.to_account_info(),
                    associated_token: self.escrow_ata.to_account_info(),
                    authority: self.payment_session.to_account_info(),
                    mint: self.token_mint.to_account_info(),
                    system_program: self.system_program.to_account_info(),
                    token_program: self.token_program.to_account_info(),
                },
            ),
        )?;

        // Initialize PaymentSession struct
        self.payment_session.set_inner(PaymentSession {
            payer: self.payer.key(),
            merchant_id,
            amount,
            token_mint: self.token_mint.key(),
            escrow_ata: self.escrow_ata.key(),
            status: PaymentSessionStatus::Initialized,
            expiry_ts,
            created_ts: now,
            funded_ts: None,
            settled_ts: None,
            bump: bumps.payment_session,
            reference_id,
            settlement_authority,
        });

        Ok(())
    }
}