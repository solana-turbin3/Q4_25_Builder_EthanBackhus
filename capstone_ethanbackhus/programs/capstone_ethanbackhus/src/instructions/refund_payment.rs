use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::{AssociatedToken, create},
    token::{Mint, Token, TokenAccount, transfer_checked, TransferChecked},
};

use crate::state::payment_session::{PaymentSession, PaymentSessionStatus, PaymentSessionRefunded};

#[derive(Accounts)]
pub struct RefundPayment<'info> {

    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        mut,
    )]
    pub payment_session: Account<'info, PaymentSession>,

    #[account(mut)]
    pub payer_ata: Account<'info, TokenAccount>,

    #[account(mut)]
    pub escrow_ata: Account<'info, TokenAccount>,

    pub token_mint: Account<'info, Mint>,    // change to USDG?

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>
}

impl<'info> RefundPayment <'info> {
    pub fn refund_payment(
        &mut self,
        uuid: [u8; 16]
    ) -> Result<()> {

        let payer = self.payer.key();

        let seeds = &[
            b"payment_session",
            payer.as_ref(),
            uuid.as_ref(),
            &[self.payment_session.bump]
        ];

        let signer_seeds = &[&seeds[..]];

        // send payment back from escrow ata to payer ata
        let cpi_accounts = TransferChecked {
            from: self.escrow_ata.to_account_info(),
            to: self.payer_ata.to_account_info(),
            authority: self.payment_session.to_account_info(),
            mint: self.token_mint.to_account_info()
        };

        let cpi_ctx = CpiContext::new_with_signer(self.token_program.to_account_info(), cpi_accounts, signer_seeds);

        transfer_checked(cpi_ctx, self.payment_session.amount, self.token_mint.decimals)?;
        
        // set paymentsession status to refunded

        self.payment_session.status = PaymentSessionStatus::Refunded;

        // emit PaymentRefunded event

        emit!(PaymentSessionRefunded {
            payer: self.payment_session.payer,
            merchant_id: self.payment_session.merchant_id.clone(),
            amount: self.payment_session.amount,
            token_mint: self.payment_session.token_mint,
            escrow_ata: self.payment_session.escrow_ata,
            payer_ata: self.payment_session.payer_ata,
            status: self.payment_session.status.clone(),
            reference_id: self.payment_session.reference_id.clone(),
            expiry_ts: self.payment_session.expiry_ts,
            settlement_authority: self.payment_session.settlement_authority,
        });

        Ok(())
    }
}