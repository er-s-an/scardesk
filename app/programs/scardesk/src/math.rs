//! Settlement arithmetic. Integer only. Prices share expo −8, so expo cancels.
//!
//! Provisional constants live on the desk account. This module is pure.

pub const LONG: u8 = 0;
pub const SHORT: u8 = 1;
pub const FUND_BALANCE: u8 = 0;
pub const FUND_QUEUED: u8 = 1;

pub const STATUS_OPEN: u8 = 0;
pub const STATUS_CLOSED: u8 = 1;
pub const STATUS_LIQUIDATED: u8 = 2;

pub const NODE_ACTIVE: u8 = 0;
pub const NODE_PAID: u8 = 1;
pub const KIND_PROFIT: u8 = 0;
pub const KIND_MARGIN: u8 = 1;

pub const PRICE_EXPO: i32 = -8;
pub const SCALE: u128 = 1_000_000_000_000;
pub const BPS: u128 = 10_000;
pub const MAX_BATCH: usize = 12;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct WinSplit {
    /// dUSD micro credited to the winner now.
    pub user_take: u64,
    /// Fee retained inside LP and reserved for stakers.
    pub fee_take: u64,
    /// Post-haircut profit still owed (FIFO).
    pub shortfall: u64,
    pub fee_full: u64,
    pub net: u64,
    pub gross: u64,
}

/// Signed PnL in dUSD micro. Positive = trader wins.
pub fn calc_pnl(side: u8, entry: i64, exit: i64, notional: u64) -> Option<i128> {
    if entry <= 0 || exit <= 0 {
        return None;
    }
    let entry = entry as i128;
    let exit = exit as i128;
    let diff = if side == LONG {
        exit.checked_sub(entry)?
    } else if side == SHORT {
        entry.checked_sub(exit)?
    } else {
        return None;
    };
    (notional as i128).checked_mul(diff)?.checked_div(entry)
}

/// Liquidation price at which `liq_fraction_bps` of margin is consumed.
/// At 1000× and 5000 bps this is a 5 bp adverse move.
pub fn calc_liq(side: u8, entry: i64, leverage: u16, liq_fraction_bps: u16) -> Option<i64> {
    if entry <= 0 || leverage == 0 {
        return None;
    }
    let move_px = (entry as i128)
        .checked_mul(liq_fraction_bps as i128)?
        .checked_div((leverage as i128).checked_mul(BPS as i128)?)?;
    let liq = if side == LONG {
        (entry as i128).checked_sub(move_px)?
    } else if side == SHORT {
        (entry as i128).checked_add(move_px)?
    } else {
        return None;
    };
    if liq <= 0 || liq > i64::MAX as i128 {
        return None;
    }
    Some(liq as i64)
}

pub fn is_liquidatable(side: u8, price: i64, liq_price: i64) -> bool {
    if side == LONG {
        price <= liq_price
    } else {
        price >= liq_price
    }
}

/// Pro-rata haircut. Fee is realized only on the portion LP can fund.
/// `lp_free` is lp_cash − reserved_fees.
pub fn split_win(pnl: u64, haircut_bps: u16, lp_free: u64) -> Option<WinSplit> {
    let gross = pnl as u128;
    let fee = gross.checked_mul(haircut_bps as u128)?.checked_div(BPS)?;
    let net = gross.checked_sub(fee)?;
    let budget = gross.min(lp_free as u128);
    let fee_take = if gross == 0 {
        0
    } else {
        fee.checked_mul(budget)?.checked_div(gross)?
    };
    let user_take = budget.checked_sub(fee_take)?;
    let shortfall = net.checked_sub(user_take)?;
    Some(WinSplit {
        user_take: user_take as u64,
        fee_take: fee_take as u64,
        shortfall: shortfall as u64,
        fee_full: fee as u64,
        net: net as u64,
        gross: pnl,
    })
}

pub fn scar_for_loss(loss: u64, emission_per_dusd: u64) -> Option<u64> {
    // Both amounts are 6-decimal. emission 100 → 100 SCAR per 1 dUSD lost.
    loss.checked_mul(emission_per_dusd)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn px(dollars: i64) -> i64 {
        dollars * 100_000_000
    }

    #[test]
    fn long_win_and_short_mirror() {
        let entry = px(100);
        let exit = px(110);
        let notion = 1_000_000_000u64; // 1_000 dUSD
        assert_eq!(calc_pnl(LONG, entry, exit, notion), Some(100_000_000));
        assert_eq!(calc_pnl(SHORT, entry, exit, notion), Some(-100_000_000));
    }

    #[test]
    fn lev_1000_liq_is_five_bps() {
        let entry = px(100);
        let liq = calc_liq(LONG, entry, 1000, 5000).unwrap();
        // 5 bps of 100 = 0.05 → 99.95
        assert_eq!(liq, px(100) - 5_000_000);
        assert!(is_liquidatable(LONG, liq, liq));
        assert!(!is_liquidatable(LONG, liq + 1, liq));
    }

    #[test]
    fn win_split_empty_lp_queues_net() {
        let s = split_win(100_000_000, 200, 0).unwrap();
        assert_eq!(s.fee_full, 2_000_000);
        assert_eq!(s.net, 98_000_000);
        assert_eq!(s.user_take, 0);
        assert_eq!(s.shortfall, 98_000_000);
        assert_eq!(s.fee_take, 0);
    }

    #[test]
    fn win_split_full_pay_reserves_fee() {
        let s = split_win(50_000_000, 200, 50_000_000).unwrap();
        assert_eq!(s.fee_take, 1_000_000);
        assert_eq!(s.user_take, 49_000_000);
        assert_eq!(s.shortfall, 0);
    }

    #[test]
    fn scar_emission() {
        assert_eq!(scar_for_loss(80_000_000, 100), Some(8_000_000_000));
    }
}
