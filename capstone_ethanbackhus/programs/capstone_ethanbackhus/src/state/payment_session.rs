use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct PaymentSession {
    pub payer: Pubkey,                      // person initializing the payment session
    #[max_len(50)]
    pub merchant_id: String,                // merchant identifier
    pub amount: u64,                        // amount to be paid in smallest unit of the token
    pub token_mint: Pubkey,                 // mint of the token being used for payment
    pub escrow_ata: Pubkey,                 // associated token account holding the funds
    pub status: PaymentSessionStatus,       // current status of the payment session
    pub expiry_ts: i64,                     // expiration timestamp
    pub bump: u8,                           // bump for PDA
    #[max_len(50)]
    pub reference_id: String,               // reference identifier for tracking
    pub settlement_authority: Pubkey,       // pubkey to where we are sending the funds? do we know yet or will the backend api tell us?
}

pub enum PaymentSessionStatus {
    Initialized,
    Funded,
    Refunded,
    Settled
}