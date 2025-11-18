use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::{AssociatedToken, create},
    token::{Mint, Token, TokenAccount},
};

use crate::state::payment_session::{PaymentSession, PaymentSessionStatus};

#[derive(Accounts)]
#[instruction(uuid: [u8; 16])]
pub struct InitPaymentSession<'info> {

    #[account(mut)]
    pub payer: Signer<'info>,

    pub token_mint: Account<'info, Mint>,

    #[account(
        mut,
        associated_token::mint = token_mint,
        associated_token::authority = payer,
    )]
    pub payer_ata: Account<'info, TokenAccount>,

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

    #[account(
        seeds = [b"settlement_authority", payment_session.key().as_ref(), uuid.as_ref()],
        bump
    )]
    /// CHECK: This PDA will be used as authority for settling payments
    pub settlement_authority: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>
}

impl<'info> InitPaymentSession<'info> {
        pub fn initialize(
        &mut self,
        uuid: [u8; 16],
        merchant_id: String,
        amount: u64,
        reference_id: String,
        fiat_currency: String,
        merchant_bank: String,
        bumps: &InitPaymentSessionBumps,
    ) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;

        // it will expire in 60 seconds for testing purposes
        let expiry_ts = now + 60;
        
        // Create escrow ATA via CPI (owned by payment_session PDA)
        create(
            CpiContext::new(
                self.associated_token_program.to_account_info(),
                anchor_spl::associated_token::Create {
                    payer: self.payer.to_account_info(),
                    associated_token: self.escrow_ata.to_account_info(),
                    authority: self.settlement_authority.to_account_info(),
                    mint: self.token_mint.to_account_info(),
                    system_program: self.system_program.to_account_info(),
                    token_program: self.token_program.to_account_info(),
                },
            ),
        )?;

        let settlement_pda = self.settlement_authority.key();

        // Initialize PaymentSession struct
        self.payment_session.set_inner(PaymentSession {
            payer: self.payer.key(),
            merchant_id,
            amount,
            token_mint: self.token_mint.key(),
            payer_ata: self.payer_ata.key(),
            escrow_ata: self.escrow_ata.key(),
            settlement_authority: settlement_pda,
            settlement_bump: bumps.settlement_authority,
            status: PaymentSessionStatus::Initialized,
            expiry_ts,
            created_ts: now,
            funded_ts: None,
            settled_ts: None,
            bump: bumps.payment_session,
            reference_id,
            uuid,
            fiat_currency: fiat_currency,
            merchant_bank: merchant_bank,
            bitpay_payout_id: None, // this wil be set later after payout creation
        });

        Ok(())
    }
}