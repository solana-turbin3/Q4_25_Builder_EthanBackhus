use anchor_lang::prelude::*;

declare_id!("3mmGkqMXHZ878yp9UpPos48FLa4HNPEKkZtHhkZemrrd");

use crate::instruction::InitPaymentSession;

#[program]
pub mod capstone_ethanbackhus {

    use super::*;

    pub fn init_payment_session(ctx: Context<InitPaymentSession>) -> Result<()> {
        
        Ok(())
    }
}
