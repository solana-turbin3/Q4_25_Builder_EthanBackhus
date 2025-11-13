use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::{AssociatedToken, create},
    token::{Mint, Token, TokenAccount, transfer_checked, TransferChecked},
};

use crate::state::payment_session::{PaymentSession, PaymentSessionCreated, PaymentSessionStatus};


#[derive(Accounts)]
#[instruction(uuid: [u8; 16])]
pub struct DepositStablecoin<'info> {

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

    pub token_mint: Account<'info, Mint>,

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

        let cpi_accounts = TransferChecked {
            from: self.payer_ata.to_account_info(),
            to: self.escrow_ata.to_account_info(),
            authority: self.payer.to_account_info(),
            mint: self.token_mint.to_account_info()
        };

        let cpi_ctx = CpiContext::new(self.token_program.to_account_info(), cpi_accounts);

        // how do know it's going to be 6 decimals here?? should this be passed in?
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

