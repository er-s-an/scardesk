use solana_program::program_error::ProgramError;

/// Stable custom errors. JS maps the same numeric codes.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[repr(u32)]
pub enum ScarError {
    BadInstruction = 0,
    AlreadyInitialized = 1,
    Unauthorized = 2,
    /// Session key tried to withdraw, stake, unstake, claim, or change session.
    SessionForbidden = 3,
    BadPrice = 4,
    InsufficientBalance = 6,
    InsufficientQueued = 7,
    BadLeverage = 8,
    BadMargin = 9,
    PositionNotOpen = 10,
    BadOwner = 11,
    QueueRequired = 12,
    BadQueueNode = 13,
    MathOverflow = 14,
    BadAccount = 15,
    InsufficientLp = 16,
    NothingToClaim = 17,
    BatchLimit = 18,
    BadStatus = 19,
    InsufficientScar = 21,
    BadFund = 22,
    AmountZero = 24,
    Inventory = 25,
    NotLiquidatable = 26,
    BadExpo = 27,
    /// Permissionless demo faucet called again inside the cooldown window.
    FaucetCooldown = 28,
}

impl From<ScarError> for ProgramError {
    fn from(e: ScarError) -> Self {
        ProgramError::Custom(e as u32)
    }
}
