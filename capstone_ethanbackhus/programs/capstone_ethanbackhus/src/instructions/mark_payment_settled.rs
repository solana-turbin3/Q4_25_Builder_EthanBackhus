use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::{AssociatedToken},
    token::{Mint, Token, TokenAccount, TransferChecked, transfer_checked},
};

use crate::state::{PaymentSessionSettled, payment_session::{PaymentSession, PaymentSessionStatus}};
use crate::{errors::PaymentError};

#[derive(Accounts)]
pub struct MarkPaymentSettled<'info> {

    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        mut,
        seeds = [b"payment_session", payer.key().as_ref(), payment_session.uuid.as_ref()],
        bump = payment_session.bump,
    )]
    pub payment_session: Account<'info, PaymentSession>,

    // Payer's token account (escrow source)
    #[account(mut)]
    pub payer_ata: Account<'info, TokenAccount>,

    // escrow token account (tokens temporarily held here)
    #[account(mut)]
    pub escrow_ata: Account<'info, TokenAccount>,

    // Merchant's token account (escrow destination)
    #[account(mut)]
    pub merchant_ata: Account<'info, TokenAccount>,

    // PDA authority over escrow_ata
    #[account(
        seeds = [b"settlement_authority", payment_session.key().as_ref(), payment_session.uuid.as_ref()],
        bump = payment_session.settlement_bump,
    )]
    /// CHECK: This PDA signs the escrow transfer
    pub settlement_authority: UncheckedAccount<'info>,

    pub token_mint: Account<'info, Mint>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>
}

impl<'info> MarkPaymentSettled <'info> {
    pub fn mark_payment_settled(
        &mut self,
        uuid: [u8; 16]
    ) -> Result<()> {

        // require the merchant ata to be the merchant id? how are we gonna do this?
        /*
        require_keys_eq!(
            self.merchant_ata.owner,
            self.payment_session.merchant_id,
            PaymentError::InvalidMerchant
        );
        */

        require_keys_eq!(
            self.merchant_ata.mint,
            self.token_mint.key(),
            PaymentError::InvalidMint
        );
    
        let payment_session_key = self.payment_session.key();

        let settlement_seeds: &[&[u8]] = &[
            b"settlement_authority",
            payment_session_key.as_ref(),
            self.payment_session.uuid.as_ref(),
            &[self.payment_session.settlement_bump]
        ];

        /*
        let seeds = &[
            b"payment_session",
            payer.as_ref(),
            uuid.as_ref(),
            &[self.payment_session.bump]
        ];*/

        //let signer_seeds = &[&seeds[..]];

        let signer_seeds = &[settlement_seeds];

        // send payment back from escrow ata to payer ata
        let cpi_accounts = TransferChecked {
            from: self.escrow_ata.to_account_info(),
            to: self.merchant_ata.to_account_info(),
            authority: self.settlement_authority.to_account_info(),
            mint: self.token_mint.to_account_info()
        };

        let cpi_ctx = CpiContext::new_with_signer(self.token_program.to_account_info(), cpi_accounts, signer_seeds);

        transfer_checked(cpi_ctx, self.payment_session.amount, self.token_mint.decimals)?;
        
        // set paymentsession status to refunded
        self.payment_session.status = PaymentSessionStatus::Settled;

        // emit PaymentSettled event
        emit!(PaymentSessionSettled{
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