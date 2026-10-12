//! Account layouts. Byte offsets are mirrored in `app/client/src/layout.js`.

use solana_program::program_error::ProgramError;
use solana_program::pubkey::Pubkey;

use crate::error::ScarError;

pub const DESK_SIZE: usize = 512;
pub const USER_SIZE: usize = 256;
pub const POSITION_SIZE: usize = 256;
pub const QUEUE_SIZE: usize = 128;
pub const ORACLE_SIZE: usize = 128;
pub const MINT_SIZE: u64 = 82;
pub const TOKEN_ACCOUNT_SIZE: u64 = 165;

pub const DISC_DESK: u8 = 1;
pub const DISC_USER: u8 = 2;
pub const DISC_POSITION: u8 = 3;
pub const DISC_QUEUE: u8 = 4;
pub const DISC_ORACLE: u8 = 5;

fn read_pubkey(data: &[u8], at: usize) -> Pubkey {
    Pubkey::try_from(&data[at..at + 32]).expect("pubkey slice")
}

fn read_u16(data: &[u8], at: usize) -> u16 {
    u16::from_le_bytes(data[at..at + 2].try_into().unwrap())
}
fn read_u32(data: &[u8], at: usize) -> u32 {
    u32::from_le_bytes(data[at..at + 4].try_into().unwrap())
}
fn read_u64(data: &[u8], at: usize) -> u64 {
    u64::from_le_bytes(data[at..at + 8].try_into().unwrap())
}
fn read_u128(data: &[u8], at: usize) -> u128 {
    u128::from_le_bytes(data[at..at + 16].try_into().unwrap())
}
fn read_i32(data: &[u8], at: usize) -> i32 {
    i32::from_le_bytes(data[at..at + 4].try_into().unwrap())
}
fn read_i64(data: &[u8], at: usize) -> i64 {
    i64::from_le_bytes(data[at..at + 8].try_into().unwrap())
}

#[derive(Clone, Debug)]
pub struct Desk {
    pub bump: u8,
    pub admin: Pubkey,
    pub dusd_mint: Pubkey,
    pub scar_mint: Pubkey,
    pub vault: Pubkey,
    pub scar_treasury: Pubkey,
    pub oracle: Pubkey,
    pub fixture_price: i64,
    pub fixture_expo: i32,
    pub fixture_time: i64,
    pub oracle_max_age: u64,
    pub max_leverage: u16,
    pub haircut_bps: u16,
    pub liq_fraction_bps: u16,
    pub min_margin: u64,
    pub emission: u64,
    pub queue_head: u64,
    pub queue_tail: u64,
    pub queue_len: u64,
    pub lp_cash: u64,
    pub reserved_fees: u64,
    pub pending_fees: u64,
    pub vault_accounted: u64,
    pub total_scar: u64,
    pub total_staked: u64,
    pub acc_reward: u128,
}

impl Desk {
    pub fn pack(&self, dst: &mut [u8]) {
        dst.fill(0);
        dst[0] = DISC_DESK;
        dst[1] = self.bump;
        dst[2] = 1;
        dst[4..36].copy_from_slice(self.admin.as_ref());
        dst[36..68].copy_from_slice(self.dusd_mint.as_ref());
        dst[68..100].copy_from_slice(self.scar_mint.as_ref());
        dst[100..132].copy_from_slice(self.vault.as_ref());
        dst[132..164].copy_from_slice(self.scar_treasury.as_ref());
        dst[164..196].copy_from_slice(self.oracle.as_ref());
        dst[196..204].copy_from_slice(&self.fixture_price.to_le_bytes());
        dst[204..208].copy_from_slice(&self.fixture_expo.to_le_bytes());
        dst[208..216].copy_from_slice(&self.fixture_time.to_le_bytes());
        dst[216..224].copy_from_slice(&self.oracle_max_age.to_le_bytes());
        dst[224..226].copy_from_slice(&self.max_leverage.to_le_bytes());
        dst[226..228].copy_from_slice(&self.haircut_bps.to_le_bytes());
        dst[228..230].copy_from_slice(&self.liq_fraction_bps.to_le_bytes());
        dst[232..240].copy_from_slice(&self.min_margin.to_le_bytes());
        dst[240..248].copy_from_slice(&self.emission.to_le_bytes());
        dst[248..256].copy_from_slice(&self.queue_head.to_le_bytes());
        dst[256..264].copy_from_slice(&self.queue_tail.to_le_bytes());
        dst[264..272].copy_from_slice(&self.queue_len.to_le_bytes());
        dst[272..280].copy_from_slice(&self.lp_cash.to_le_bytes());
        dst[280..288].copy_from_slice(&self.reserved_fees.to_le_bytes());
        dst[288..296].copy_from_slice(&self.pending_fees.to_le_bytes());
        dst[296..304].copy_from_slice(&self.vault_accounted.to_le_bytes());
        dst[304..312].copy_from_slice(&self.total_scar.to_le_bytes());
        dst[312..320].copy_from_slice(&self.total_staked.to_le_bytes());
        dst[320..336].copy_from_slice(&self.acc_reward.to_le_bytes());
    }

    pub fn unpack(data: &[u8]) -> Result<Self, ProgramError> {
        if data.len() < DESK_SIZE || data[0] != DISC_DESK {
            return Err(ScarError::BadAccount.into());
        }
        Ok(Self {
            bump: data[1],
            admin: read_pubkey(data, 4),
            dusd_mint: read_pubkey(data, 36),
            scar_mint: read_pubkey(data, 68),
            vault: read_pubkey(data, 100),
            scar_treasury: read_pubkey(data, 132),
            oracle: read_pubkey(data, 164),
            fixture_price: read_i64(data, 196),
            fixture_expo: read_i32(data, 204),
            fixture_time: read_i64(data, 208),
            oracle_max_age: read_u64(data, 216),
            max_leverage: read_u16(data, 224),
            haircut_bps: read_u16(data, 226),
            liq_fraction_bps: read_u16(data, 228),
            min_margin: read_u64(data, 232),
            emission: read_u64(data, 240),
            queue_head: read_u64(data, 248),
            queue_tail: read_u64(data, 256),
            queue_len: read_u64(data, 264),
            lp_cash: read_u64(data, 272),
            reserved_fees: read_u64(data, 280),
            pending_fees: read_u64(data, 288),
            vault_accounted: read_u64(data, 296),
            total_scar: read_u64(data, 304),
            total_staked: read_u64(data, 312),
            acc_reward: read_u128(data, 320),
        })
    }

    pub fn lp_free(&self) -> u64 {
        self.lp_cash.saturating_sub(self.reserved_fees)
    }
}

#[derive(Clone, Debug)]
pub struct User {
    pub bump: u8,
    pub has_session: u8,
    pub owner: Pubkey,
    pub session: Pubkey,
    pub balance: u64,
    pub queued: u64,
    pub scar: u64,
    pub staked: u64,
    pub claimable: u64,
    pub reward_debt: u128,
    pub next_id: u64,
    pub open_count: u32,
}

impl User {
    pub fn pack(&self, dst: &mut [u8]) {
        dst.fill(0);
        dst[0] = DISC_USER;
        dst[1] = self.bump;
        dst[2] = self.has_session;
        dst[4..36].copy_from_slice(self.owner.as_ref());
        dst[36..68].copy_from_slice(self.session.as_ref());
        dst[68..76].copy_from_slice(&self.balance.to_le_bytes());
        dst[76..84].copy_from_slice(&self.queued.to_le_bytes());
        dst[84..92].copy_from_slice(&self.scar.to_le_bytes());
        dst[92..100].copy_from_slice(&self.staked.to_le_bytes());
        dst[100..108].copy_from_slice(&self.claimable.to_le_bytes());
        dst[108..124].copy_from_slice(&self.reward_debt.to_le_bytes());
        dst[124..132].copy_from_slice(&self.next_id.to_le_bytes());
        dst[132..136].copy_from_slice(&self.open_count.to_le_bytes());
    }

    pub fn unpack(data: &[u8]) -> Result<Self, ProgramError> {
        if data.len() < USER_SIZE || data[0] != DISC_USER {
            return Err(ScarError::BadAccount.into());
        }
        Ok(Self {
            bump: data[1],
            has_session: data[2],
            owner: read_pubkey(data, 4),
            session: read_pubkey(data, 36),
            balance: read_u64(data, 68),
            queued: read_u64(data, 76),
            scar: read_u64(data, 84),
            staked: read_u64(data, 92),
            claimable: read_u64(data, 100),
            reward_debt: read_u128(data, 108),
            next_id: read_u64(data, 124),
            open_count: read_u32(data, 132),
        })
    }
}

#[derive(Clone, Debug)]
pub struct Position {
    pub bump: u8,
    pub side: u8,
    pub status: u8,
    pub fund_from: u8,
    pub owner: Pubkey,
    pub id: u64,
    pub margin: u64,
    pub leverage: u16,
    pub entry_price: i64,
    pub exit_price: i64,
    pub notional: u64,
    pub liq_price: i64,
    pub pnl: i64,
    pub fee: u64,
    pub scar_minted: u64,
    pub opened_at: i64,
    pub closed_at: i64,
    pub cash_margin: u64,
    pub queued_margin: u64,
    pub paid_out: u64,
    pub queued_credit: u64,
}

impl Position {
    pub fn pack(&self, dst: &mut [u8]) {
        dst.fill(0);
        dst[0] = DISC_POSITION;
        dst[1] = self.side;
        dst[2] = self.status;
        dst[3] = self.fund_from;
        dst[4] = self.bump;
        dst[8..40].copy_from_slice(self.owner.as_ref());
        dst[40..48].copy_from_slice(&self.id.to_le_bytes());
        dst[48..56].copy_from_slice(&self.margin.to_le_bytes());
        dst[56..58].copy_from_slice(&self.leverage.to_le_bytes());
        dst[60..68].copy_from_slice(&self.entry_price.to_le_bytes());
        dst[68..76].copy_from_slice(&self.exit_price.to_le_bytes());
        dst[76..84].copy_from_slice(&self.notional.to_le_bytes());
        dst[84..92].copy_from_slice(&self.liq_price.to_le_bytes());
        dst[92..100].copy_from_slice(&self.pnl.to_le_bytes());
        dst[100..108].copy_from_slice(&self.fee.to_le_bytes());
        dst[108..116].copy_from_slice(&self.scar_minted.to_le_bytes());
        dst[116..124].copy_from_slice(&self.opened_at.to_le_bytes());
        dst[124..132].copy_from_slice(&self.closed_at.to_le_bytes());
        dst[132..140].copy_from_slice(&self.cash_margin.to_le_bytes());
        dst[140..148].copy_from_slice(&self.queued_margin.to_le_bytes());
        dst[148..156].copy_from_slice(&self.paid_out.to_le_bytes());
        dst[156..164].copy_from_slice(&self.queued_credit.to_le_bytes());
    }

    pub fn unpack(data: &[u8]) -> Result<Self, ProgramError> {
        if data.len() < POSITION_SIZE || data[0] != DISC_POSITION {
            return Err(ScarError::BadAccount.into());
        }
        Ok(Self {
            bump: data[4],
            side: data[1],
            status: data[2],
            fund_from: data[3],
            owner: read_pubkey(data, 8),
            id: read_u64(data, 40),
            margin: read_u64(data, 48),
            leverage: read_u16(data, 56),
            entry_price: read_i64(data, 60),
            exit_price: read_i64(data, 68),
            notional: read_u64(data, 76),
            liq_price: read_i64(data, 84),
            pnl: read_i64(data, 92),
            fee: read_u64(data, 100),
            scar_minted: read_u64(data, 108),
            opened_at: read_i64(data, 116),
            closed_at: read_i64(data, 124),
            cash_margin: read_u64(data, 132),
            queued_margin: read_u64(data, 140),
            paid_out: read_u64(data, 148),
            queued_credit: read_u64(data, 156),
        })
    }
}

#[derive(Clone, Debug)]
pub struct QueueNode {
    pub bump: u8,
    pub status: u8,
    pub kind: u8,
    pub owner: Pubkey,
    pub index: u64,
    pub total: u64,
    pub remaining: u64,
    pub position_id: u64,
    pub enqueued_at: i64,
}

impl QueueNode {
    pub fn pack(&self, dst: &mut [u8]) {
        dst.fill(0);
        dst[0] = DISC_QUEUE;
        dst[1] = self.status;
        dst[2] = self.kind;
        dst[3] = self.bump;
        dst[8..16].copy_from_slice(&self.index.to_le_bytes());
        dst[16..48].copy_from_slice(self.owner.as_ref());
        dst[48..56].copy_from_slice(&self.total.to_le_bytes());
        dst[56..64].copy_from_slice(&self.remaining.to_le_bytes());
        dst[64..72].copy_from_slice(&self.position_id.to_le_bytes());
        dst[72..80].copy_from_slice(&self.enqueued_at.to_le_bytes());
    }

    pub fn unpack(data: &[u8]) -> Result<Self, ProgramError> {
        if data.len() < QUEUE_SIZE || data[0] != DISC_QUEUE {
            return Err(ScarError::BadAccount.into());
        }
        Ok(Self {
            bump: data[3],
            status: data[1],
            kind: data[2],
            owner: read_pubkey(data, 16),
            index: read_u64(data, 8),
            total: read_u64(data, 48),
            remaining: read_u64(data, 56),
            position_id: read_u64(data, 64),
            enqueued_at: read_i64(data, 72),
        })
    }
}

#[derive(Clone, Debug)]
pub struct Oracle {
    pub source: u8,
    pub price: i64,
    pub expo: i32,
    pub publish_time: i64,
    pub conf: u64,
}

impl Oracle {
    pub fn pack(&self, dst: &mut [u8]) {
        dst.fill(0);
        dst[0] = DISC_ORACLE;
        dst[1] = self.source;
        dst[8..16].copy_from_slice(&self.price.to_le_bytes());
        dst[16..20].copy_from_slice(&self.expo.to_le_bytes());
        dst[24..32].copy_from_slice(&self.publish_time.to_le_bytes());
        dst[32..40].copy_from_slice(&self.conf.to_le_bytes());
    }

    pub fn unpack(data: &[u8]) -> Result<Self, ProgramError> {
        if data.len() < ORACLE_SIZE || data[0] != DISC_ORACLE {
            return Err(ScarError::BadAccount.into());
        }
        Ok(Self {
            source: data[1],
            price: read_i64(data, 8),
            expo: read_i32(data, 16),
            publish_time: read_i64(data, 24),
            conf: read_u64(data, 32),
        })
    }
}

pub fn token_amount(data: &[u8]) -> Result<u64, ProgramError> {
    if data.len() < 72 {
        return Err(ScarError::BadAccount.into());
    }
    Ok(read_u64(data, 64))
}

pub fn token_mint(data: &[u8]) -> Result<Pubkey, ProgramError> {
    if data.len() < 64 {
        return Err(ScarError::BadAccount.into());
    }
    Ok(read_pubkey(data, 0))
}

pub fn token_owner(data: &[u8]) -> Result<Pubkey, ProgramError> {
    if data.len() < 64 {
        return Err(ScarError::BadAccount.into());
    }
    Ok(read_pubkey(data, 32))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn desk_roundtrip() {
        let d = Desk {
            bump: 254,
            admin: Pubkey::new_unique(),
            dusd_mint: Pubkey::new_unique(),
            scar_mint: Pubkey::new_unique(),
            vault: Pubkey::new_unique(),
            scar_treasury: Pubkey::new_unique(),
            oracle: Pubkey::new_unique(),
            fixture_price: 15_000_000_000,
            fixture_expo: -8,
            fixture_time: 1_700_000_000,
            oracle_max_age: 60,
            max_leverage: 1000,
            haircut_bps: 200,
            liq_fraction_bps: 5000,
            min_margin: 1_000_000,
            emission: 100,
            queue_head: 2,
            queue_tail: 5,
            queue_len: 3,
            lp_cash: 12,
            reserved_fees: 1,
            pending_fees: 1,
            vault_accounted: 99,
            total_scar: 7,
            total_staked: 4,
            acc_reward: 123456789,
        };
        let mut buf = vec![0u8; DESK_SIZE];
        d.pack(&mut buf);
        let u = Desk::unpack(&buf).unwrap();
        assert_eq!(u.admin, d.admin);
        assert_eq!(u.scar_mint, d.scar_mint);
        assert_eq!(u.max_leverage, 1000);
        assert_eq!(u.queue_tail, 5);
        assert_eq!(u.acc_reward, 123456789);
        assert_eq!(u.fixture_expo, -8);
        assert_eq!(u.lp_free(), 11);
    }
}
