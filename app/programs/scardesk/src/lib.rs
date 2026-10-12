//! Scardesk — synthetic SOL/USD perps vs a loss-funded LP.
//!
//! There is no set_balance, set_pnl, or mint_free instruction.
//! dUSD balances move only on deposit, withdraw, and settlement.
//! SCAR is minted only when a loss or a liquidation is settled.

pub mod error;
pub mod math;
pub mod processor;
pub mod state;

use solana_program::account_info::AccountInfo;
use solana_program::entrypoint::ProgramResult;
use solana_program::pubkey::Pubkey;

#[cfg(not(feature = "no-entrypoint"))]
solana_program::entrypoint!(process_instruction);

pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    processor::process(program_id, accounts, instruction_data)
}
