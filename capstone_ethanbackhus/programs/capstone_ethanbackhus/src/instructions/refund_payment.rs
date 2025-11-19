use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::{AssociatedToken},
    token::{Mint, Token, TokenAccount, transfer_checked, TransferChecked},
};

use crate::state::payment_session::{PaymentSession, PaymentSessionStatus, PaymentSessionRefunded};

#[derive(Accounts)]
pub struct RefundPayment<'info> {

    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(mut)]
    pub payment_session: Account<'info, PaymentSession>,

    #[account(mut)]
    pub payer_ata: Account<'info, TokenAccount>,

    #[account(mut)]
    pub escrow_ata: Account<'info, TokenAccount>,

    // PDA authority over escrow_ata
    #[account(
        seeds = [b"settlement_authority", payment_session.key().as_ref(), payment_session.uuid.as_ref()],
        bump = payment_session.settlement_bump,
    )]
    /// CHECK: This PDA signs the escrow transfer
    pub settlement_authority: UncheckedAccount<'info>,

    pub token_mint: Account<'info, Mint>,

    pub token_program: Program<'info, Token>,
}

impl<'info> RefundPayment <'info> {
    pub fn refund_payment(
        &mut self,
    ) -> Result<()> {

        let payment_key = self.payment_session.key();

        let seeds = &[
            b"settlement_authority",
            payment_key.as_ref(),
            self.payment_session.uuid.as_ref(),
            &[self.payment_session.settlement_bump]
        ];

        let signer_seeds = &[&seeds[..]];

        // send payment back from escrow ata to payer ata
        let cpi_accounts = TransferChecked {
            from: self.escrow_ata.to_account_info(),
            to: self.payer_ata.to_account_info(),
            authority: self.settlement_authority.to_account_info(),
            mint: self.token_mint.to_account_info()
        };

        let cpi_ctx = CpiContext::new_with_signer(
            self.token_program.to_account_info(), 
            cpi_accounts, 
            signer_seeds
        );

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