use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::{AssociatedToken},
    token::{Mint, Token, TokenAccount, transfer_checked, TransferChecked},
};

use crate::state::payment_session::{PaymentSession, PaymentSessionCreated, PaymentSessionStatus};


#[derive(Accounts)]
pub struct DepositStablecoin<'info> {

    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(mut)]
    pub payment_session: Account<'info, PaymentSession>,

    #[account(mut)]
    pub payer_ata: Account<'info, TokenAccount>,

    #[account(mut)]
    pub escrow_ata: Account<'info, TokenAccount>,

    #[account(
        seeds = [b"settlement_authority", payment_session.key().as_ref(), payment_session.uuid.as_ref()],
        bump = payment_session.settlement_bump,
    )]
    /// CHECK: This PDA will be used as authority for settling payments
    pub settlement_authority: UncheckedAccount<'info>,

    pub token_mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>
}

impl<'info> DepositStablecoin <'info> {
    pub fn deposit_stablecoin(
        &mut self
    ) -> Result<()> {

        let cpi_accounts = TransferChecked {
            from: self.payer_ata.to_account_info(),
            to: self.escrow_ata.to_account_info(),
            authority: self.payer.to_account_info(),
            mint: self.token_mint.to_account_info()
        };

        let cpi_ctx = CpiContext::new(self.token_program.to_account_info(), cpi_accounts);

        // execute token transfer from payer_ata to escrow_ata
        transfer_checked(cpi_ctx, self.payment_session.amount, self.token_mint.decimals)?;
        
        // update PDA session status to funded
        self.payment_session.status = PaymentSessionStatus::Funded;

        // emit PaymentSession created event
        emit!(PaymentSessionCreated {
            payer: self.payer.key(),
            merchant_id: self.payment_session.merchant_id.clone(),
            amount: self.payment_session.amount,
            token_mint: self.token_mint.key(),
            escrow_ata: self.escrow_ata.key(),
            payer_ata: self.payer_ata.key(),
            status: self.payment_session.status.clone(),
            expiry_ts: self.payment_session.expiry_ts,
            created_ts: self.payment_session.created_ts,
            funded_ts: self.payment_session.funded_ts,
            settled_ts: self.payment_session.settled_ts,
            reference_id: self.payment_session.reference_id.clone(),
            settlement_authority: self.payment_session.settlement_authority,
        });

        // then webhook will detect event

        Ok(())
    }
}

