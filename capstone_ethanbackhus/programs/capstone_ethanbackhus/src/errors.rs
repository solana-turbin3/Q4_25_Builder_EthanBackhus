use anchor_lang::error_code;

#[error_code]
pub enum PaymentError {
    #[msg("The merchant account provided does not match the payment session's merchant ID.")]
    InvalidMerchant,
    #[msg("The token mint provided does not match the payment session's token mint.")]
    InvalidMint,
    #[msg("The payment session is not in a state that allows this operation.")]
    InvalidPaymentSessionState,
    #[msg("Insufficient funds in the escrow account to complete the settlement.")]
    InsufficientEscrowFunds,
}