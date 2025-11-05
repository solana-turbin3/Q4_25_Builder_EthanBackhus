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
    pub created_ts: i64,                    // created timestamp (to make monitoring and debugging much easier)
    pub funded_ts: Option<i64>,             // funded timestamp
    pub settled_ts: Option<i64>,            // settled timestamp
    pub bump: u8,                           // bump for PDA
    #[max_len(50)]
    pub reference_id: String,               // reference identifier for tracking
    pub settlement_authority: Pubkey,       // pubkey to where we are sending the funds? do we know yet or will the backend api tell us?
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, Debug)]
#[repr(u8)]
pub enum PaymentSessionStatus {
    Initialized,
    Funded,
    Refunded,
    Settled
}

impl Default for PaymentSessionStatus {
    fn default() -> Self {
        Self::Initialized
    }
}

impl Space for PaymentSessionStatus {
    const INIT_SPACE: usize = 1; // u8 representation
}