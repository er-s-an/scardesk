//! Instruction processors. Account order is the contract the JS client uses.

use solana_program::account_info::AccountInfo;
use solana_program::clock::Clock;
use solana_program::entrypoint::ProgramResult;
use solana_program::msg;
use solana_program::program::invoke;
use solana_program::program::invoke_signed;
use solana_program::program_error::ProgramError;
use solana_program::pubkey::Pubkey;
use solana_program::rent::Rent;
use solana_program::sysvar::Sysvar;
use solana_program::system_instruction;
use solana_program::system_program;

use crate::error::ScarError;
use crate::math::*;
use crate::state::*;

const IX_INIT: u8 = 0;
const IX_INIT_USER: u8 = 1;
const IX_INIT_WALLET: u8 = 2;
const IX_FAUCET: u8 = 3;
const IX_DEPOSIT: u8 = 4;
const IX_WITHDRAW: u8 = 5;
const IX_SET_SESSION: u8 = 6;
const IX_CLEAR_SESSION: u8 = 7;
const IX_PUSH_ORACLE: u8 = 8;
const IX_SET_FIXTURE: u8 = 9;
const IX_OPEN: u8 = 10;
const IX_CLOSE: u8 = 11;
const IX_LIQUIDATE: u8 = 12;
const IX_STAKE: u8 = 13;
const IX_UNSTAKE: u8 = 14;
const IX_CLAIM: u8 = 15;

pub fn process(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    data: &[u8],
) -> ProgramResult {
    let (tag, rest) = data.split_first().ok_or(ScarError::BadInstruction)?;
    match tag {
        &IX_INIT => initialize(program_id, accounts, rest),
        &IX_INIT_USER => init_user(program_id, accounts),
        &IX_INIT_WALLET => init_wallet(program_id, accounts),
        &IX_FAUCET => faucet(program_id, accounts, rest),
        &IX_DEPOSIT => deposit(program_id, accounts, rest),
        &IX_WITHDRAW => withdraw(program_id, accounts, rest),
        &IX_SET_SESSION => set_session(program_id, accounts, rest, true),
        &IX_CLEAR_SESSION => set_session(program_id, accounts, rest, false),
        &IX_PUSH_ORACLE => push_oracle(program_id, accounts, rest),
        &IX_SET_FIXTURE => set_fixture(program_id, accounts, rest),
        &IX_OPEN => open_position(program_id, accounts, rest),
        &IX_CLOSE => close_positions(program_id, accounts, rest),
        &IX_LIQUIDATE => liquidate(program_id, accounts, rest),
        &IX_STAKE => stake(program_id, accounts, rest, true),
        &IX_UNSTAKE => stake(program_id, accounts, rest, false),
        &IX_CLAIM => claim(program_id, accounts),
        _ => Err(ScarError::BadInstruction.into()),
    }
}

fn initialize(program_id: &Pubkey, accounts: &[AccountInfo], data: &[u8]) -> ProgramResult {
    if accounts.len() < 10 || data.len() < 44 {
        return Err(ScarError::BadInstruction.into());
    }
    let admin = &accounts[0];
    let desk_ai = &accounts[1];
    let dusd = &accounts[2];
    let scar = &accounts[3];
    let vault = &accounts[4];
    let treasury = &accounts[5];
    let oracle_ai = &accounts[6];
    let system = &accounts[7];
    let token_program = &accounts[8];
    let rent_ai = &accounts[9];
    require_signer(admin)?;
    require_key(system, &system_program::ID)?;
    require_key(token_program, &spl_token::id())?;
    require_key(rent_ai, &solana_program::sysvar::rent::ID)?;

    let max_leverage = read_u16(data, 0)?;
    let haircut_bps = read_u16(data, 2)?;
    let liq_fraction_bps = read_u16(data, 4)?;
    let min_margin = read_u64(data, 8)?;
    let emission = read_u64(data, 16)?;
    let oracle_max_age = read_u64(data, 24)?;
    let fixture_price = read_i64(data, 32)?;
    let fixture_expo = read_i32(data, 40)?;
    if !(1..=1000).contains(&max_leverage) || haircut_bps > 2_000 || liq_fraction_bps == 0
        || liq_fraction_bps > 10_000 || min_margin == 0 || emission == 0
        || oracle_max_age == 0 || fixture_price <= 0 || fixture_expo != PRICE_EXPO
    {
        return Err(ScarError::BadInstruction.into());
    }

    let (desk_pda, desk_bump) = Pubkey::find_program_address(&[b"desk"], program_id);
    let (dusd_pda, dusd_bump) = Pubkey::find_program_address(&[b"dusd"], program_id);
    let (scar_pda, scar_bump) = Pubkey::find_program_address(&[b"scar"], program_id);
    let (vault_pda, vault_bump) = Pubkey::find_program_address(&[b"vault"], program_id);
    let (tre_pda, tre_bump) = Pubkey::find_program_address(&[b"treasury"], program_id);
    let (oracle_pda, oracle_bump) = Pubkey::find_program_address(&[b"oracle"], program_id);
    require_pda(desk_ai, &desk_pda)?;
    require_pda(dusd, &dusd_pda)?;
    require_pda(scar, &scar_pda)?;
    require_pda(vault, &vault_pda)?;
    require_pda(treasury, &tre_pda)?;
    require_pda(oracle_ai, &oracle_pda)?;

    let desk_bump_s = [desk_bump];
    let dusd_bump_s = [dusd_bump];
    let scar_bump_s = [scar_bump];
    let vault_bump_s = [vault_bump];
    let tre_bump_s = [tre_bump];
    let oracle_bump_s = [oracle_bump];

    create_pda(admin, desk_ai, system, DESK_SIZE, program_id, &[&[b"desk", &desk_bump_s]])?;
    create_pda(admin, dusd, system, MINT_SIZE as usize, &spl_token::id(), &[&[b"dusd", &dusd_bump_s]])?;
    create_pda(admin, scar, system, MINT_SIZE as usize, &spl_token::id(), &[&[b"scar", &scar_bump_s]])?;
    create_pda(
        admin,
        vault,
        system,
        TOKEN_ACCOUNT_SIZE as usize,
        &spl_token::id(),
        &[&[b"vault", &vault_bump_s]],
    )?;
    create_pda(
        admin,
        treasury,
        system,
        TOKEN_ACCOUNT_SIZE as usize,
        &spl_token::id(),
        &[&[b"treasury", &tre_bump_s]],
    )?;
    create_pda(
        admin,
        oracle_ai,
        system,
        ORACLE_SIZE,
        program_id,
        &[&[b"oracle", &oracle_bump_s]],
    )?;

    invoke(
        &spl_token::instruction::initialize_mint(
            &spl_token::id(),
            dusd.key,
            desk_ai.key,
            None,
            6,
        )?,
        &[dusd.clone(), rent_ai.clone(), token_program.clone()],
    )?;
    invoke(
        &spl_token::instruction::initialize_mint(
            &spl_token::id(),
            scar.key,
            desk_ai.key,
            Some(desk_ai.key),
            6,
        )?,
        &[scar.clone(), rent_ai.clone(), token_program.clone()],
    )?;
    invoke(
        &spl_token::instruction::initialize_account(
            &spl_token::id(),
            vault.key,
            dusd.key,
            desk_ai.key,
        )?,
        &[vault.clone(), dusd.clone(), desk_ai.clone(), rent_ai.clone(), token_program.clone()],
    )?;
    invoke(
        &spl_token::instruction::initialize_account(
            &spl_token::id(),
            treasury.key,
            scar.key,
            desk_ai.key,
        )?,
        &[
            treasury.clone(),
            scar.clone(),
            desk_ai.clone(),
            rent_ai.clone(),
            token_program.clone(),
        ],
    )?;

    let now = Clock::get()?.unix_timestamp;
    let desk = Desk {
        bump: desk_bump,
        admin: *admin.key,
        dusd_mint: *dusd.key,
        scar_mint: *scar.key,
        vault: *vault.key,
        scar_treasury: *treasury.key,
        oracle: *oracle_ai.key,
        fixture_price,
        fixture_expo,
        fixture_time: now,
        oracle_max_age,
        max_leverage,
        haircut_bps,
        liq_fraction_bps,
        min_margin,
        emission,
        queue_head: 0,
        queue_tail: 0,
        queue_len: 0,
        lp_cash: 0,
        reserved_fees: 0,
        pending_fees: 0,
        vault_accounted: 0,
        total_scar: 0,
        total_staked: 0,
        acc_reward: 0,
    };
    write_bytes(desk_ai, &desk_pack(&desk)?)?;
    let oracle = Oracle {
        source: 2,
        price: 0,
        expo: PRICE_EXPO,
        publish_time: 0,
        conf: 0,
    };
    write_bytes(oracle_ai, &oracle_pack(&oracle)?)?;

    // The treasury token account is owned by the desk PDA and no user account
    // is ever created, so SCAR cannot be transferred. Do not freeze it:
    // SPL mint_to rejects a frozen destination.
    msg!("evt=init;desk={};scar={};dusd={}", desk_ai.key, scar.key, dusd.key);
    Ok(())
}

fn init_user(program_id: &Pubkey, accounts: &[AccountInfo]) -> ProgramResult {
    if accounts.len() < 3 {
        return Err(ScarError::BadInstruction.into());
    }
    let owner = &accounts[0];
    let user_ai = &accounts[1];
    let system = &accounts[2];
    require_signer(owner)?;
    require_key(system, &system_program::ID)?;
    let (pda, bump) = Pubkey::find_program_address(&[b"user", owner.key.as_ref()], program_id);
    require_pda(user_ai, &pda)?;
    let bump_s = [bump];
    create_pda(owner, user_ai, system, USER_SIZE, program_id, &[&[b"user", owner.key.as_ref(), &bump_s]])?;
    let user = User {
        bump,
        has_session: 0,
        owner: *owner.key,
        session: Pubkey::default(),
        balance: 0,
        queued: 0,
        scar: 0,
        staked: 0,
        claimable: 0,
        reward_debt: 0,
        next_id: 0,
        open_count: 0,
    };
    write_bytes(user_ai, &user_pack(&user)?)?;
    msg!("evt=init_user;owner={}", owner.key);
    Ok(())
}

fn init_wallet(program_id: &Pubkey, accounts: &[AccountInfo]) -> ProgramResult {
    if accounts.len() < 7 {
        return Err(ScarError::BadInstruction.into());
    }
    let owner = &accounts[0];
    let wallet = &accounts[1];
    let dusd = &accounts[2];
    let desk_ai = &accounts[3];
    let system = &accounts[4];
    let token_program = &accounts[5];
    let rent_ai = &accounts[6];
    require_signer(owner)?;
    require_key(system, &system_program::ID)?;
    require_key(token_program, &spl_token::id())?;
    require_key(rent_ai, &solana_program::sysvar::rent::ID)?;
    let desk = load_desk(program_id, desk_ai)?;
    require_pda(dusd, &desk.dusd_mint)?;
    let (pda, bump) = Pubkey::find_program_address(&[b"w", owner.key.as_ref()], program_id);
    require_pda(wallet, &pda)?;
    let bump_s = [bump];
    create_pda(
        owner,
        wallet,
        system,
        TOKEN_ACCOUNT_SIZE as usize,
        &spl_token::id(),
        &[&[b"w", owner.key.as_ref(), &bump_s]],
    )?;
    invoke(
        &spl_token::instruction::initialize_account(&spl_token::id(), wallet.key, dusd.key, owner.key)?,
        &[wallet.clone(), dusd.clone(), owner.clone(), rent_ai.clone(), token_program.clone()],
    )?;
    msg!("evt=init_wallet;owner={};wallet={}", owner.key, wallet.key);
    Ok(())
}

fn faucet(program_id: &Pubkey, accounts: &[AccountInfo], data: &[u8]) -> ProgramResult {
    if accounts.len() < 5 {
        return Err(ScarError::BadInstruction.into());
    }
    let admin = &accounts[0];
    let desk_ai = &accounts[1];
    let dusd = &accounts[2];
    let wallet = &accounts[3];
    let token_program = &accounts[4];
    require_signer(admin)?;
    require_key(token_program, &spl_token::id())?;
    let desk = load_desk(program_id, desk_ai)?;
    if admin.key != &desk.admin {
        return Err(ScarError::Unauthorized.into());
    }
    require_pda(dusd, &desk.dusd_mint)?;
    let amount = read_u64(data, 0)?;
    if amount == 0 {
        return Err(ScarError::AmountZero.into());
    }
    let wdata = wallet.data.borrow();
    let mint = token_mint(&wdata)?;
    drop(wdata);
    if mint != desk.dusd_mint {
        return Err(ScarError::BadAccount.into());
    }
    let (desk_pda, bump) = Pubkey::find_program_address(&[b"desk"], program_id);
    require_pda(desk_ai, &desk_pda)?;
    let bump_s = [bump];
    let seeds: &[&[u8]] = &[b"desk", &bump_s];
    invoke_signed(
        &spl_token::instruction::mint_to(&spl_token::id(), dusd.key, wallet.key, desk_ai.key, &[], amount)?,
        &[dusd.clone(), wallet.clone(), desk_ai.clone(), token_program.clone()],
        &[seeds],
    )?;
    msg!("evt=faucet;amount={};wallet={}", amount, wallet.key);
    Ok(())
}

fn deposit(program_id: &Pubkey, accounts: &[AccountInfo], data: &[u8]) -> ProgramResult {
    if accounts.len() < 6 {
        return Err(ScarError::BadInstruction.into());
    }
    let owner = &accounts[0];
    let user_ai = &accounts[1];
    let wallet = &accounts[2];
    let vault = &accounts[3];
    let desk_ai = &accounts[4];
    let token_program = &accounts[5];
    require_signer(owner)?;
    require_key(token_program, &spl_token::id())?;
    let mut desk = load_desk(program_id, desk_ai)?;
    let mut user = load_user(program_id, user_ai)?;
    require_owner(&user, owner, "deposit")?;
    require_pda(vault, &desk.vault)?;
    let amount = read_u64(data, 0)?;
    if amount == 0 {
        return Err(ScarError::AmountZero.into());
    }
    {
        let wdata = wallet.data.borrow();
        if token_mint(&wdata)? != desk.dusd_mint || token_owner(&wdata)? != user.owner {
            return Err(ScarError::BadAccount.into());
        }
    }
    invoke(
        &spl_token::instruction::transfer(
            &spl_token::id(),
            wallet.key,
            vault.key,
            owner.key,
            &[],
            amount,
        )?,
        &[wallet.clone(), vault.clone(), owner.clone(), token_program.clone()],
    )?;
    user.balance = user.balance.checked_add(amount).ok_or(ScarError::MathOverflow)?;
    desk.vault_accounted = desk.vault_accounted.checked_add(amount).ok_or(ScarError::MathOverflow)?;
    let actual = token_amount(&vault.data.borrow())?;
    if actual != desk.vault_accounted {
        msg!("evt=inventory;actual={};accounted={}", actual, desk.vault_accounted);
        return Err(ScarError::Inventory.into());
    }
    write_user(user_ai, &user)?;
    write_desk(desk_ai, &desk)?;
    msg!("evt=deposit;amount={};balance={}", amount, user.balance);
    Ok(())
}

fn withdraw(program_id: &Pubkey, accounts: &[AccountInfo], data: &[u8]) -> ProgramResult {
    if accounts.len() < 6 {
        return Err(ScarError::BadInstruction.into());
    }
    let signer = &accounts[0];
    let user_ai = &accounts[1];
    let wallet = &accounts[2];
    let vault = &accounts[3];
    let desk_ai = &accounts[4];
    let token_program = &accounts[5];
    require_signer(signer)?;
    require_key(token_program, &spl_token::id())?;
    let mut desk = load_desk(program_id, desk_ai)?;
    let mut user = load_user(program_id, user_ai)?;
    require_owner(&user, signer, "withdraw")?;
    require_pda(vault, &desk.vault)?;
    let amount = read_u64(data, 0)?;
    if amount == 0 {
        return Err(ScarError::AmountZero.into());
    }
    if user.balance < amount {
        return Err(ScarError::InsufficientBalance.into());
    }
    {
        let wdata = wallet.data.borrow();
        if token_mint(&wdata)? != desk.dusd_mint || token_owner(&wdata)? != user.owner {
            return Err(ScarError::BadAccount.into());
        }
    }
    let (desk_pda, bump) = Pubkey::find_program_address(&[b"desk"], program_id);
    require_pda(desk_ai, &desk_pda)?;
    let bump_s = [bump];
    let seeds: &[&[u8]] = &[b"desk", &bump_s];
    invoke_signed(
        &spl_token::instruction::transfer(
            &spl_token::id(),
            vault.key,
            wallet.key,
            desk_ai.key,
            &[],
            amount,
        )?,
        &[vault.clone(), wallet.clone(), desk_ai.clone(), token_program.clone()],
        &[seeds],
    )?;
    user.balance -= amount;
    desk.vault_accounted -= amount;
    let actual = token_amount(&vault.data.borrow())?;
    if actual != desk.vault_accounted {
        return Err(ScarError::Inventory.into());
    }
    write_user(user_ai, &user)?;
    write_desk(desk_ai, &desk)?;
    msg!("evt=withdraw;amount={};balance={}", amount, user.balance);
    Ok(())
}

fn set_session(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    data: &[u8],
    enable: bool,
) -> ProgramResult {
    if accounts.len() < 2 {
        return Err(ScarError::BadInstruction.into());
    }
    let signer = &accounts[0];
    let user_ai = &accounts[1];
    require_signer(signer)?;
    let mut user = load_user(program_id, user_ai)?;
    require_owner(&user, signer, "session")?;
    if enable {
        if data.len() < 32 {
            return Err(ScarError::BadInstruction.into());
        }
        let session = Pubkey::try_from(&data[0..32]).map_err(|_| ScarError::BadInstruction)?;
        if session == user.owner || session == Pubkey::default() {
            return Err(ScarError::BadAccount.into());
        }
        user.session = session;
        user.has_session = 1;
        msg!("evt=session_set;session={}", session);
    } else {
        user.has_session = 0;
        user.session = Pubkey::default();
        msg!("evt=session_clear");
    }
    write_user(user_ai, &user)?;
    Ok(())
}

fn push_oracle(program_id: &Pubkey, accounts: &[AccountInfo], data: &[u8]) -> ProgramResult {
    if accounts.len() < 3 || data.len() < 32 {
        return Err(ScarError::BadInstruction.into());
    }
    let admin = &accounts[0];
    let desk_ai = &accounts[1];
    let oracle_ai = &accounts[2];
    require_signer(admin)?;
    let desk = load_desk(program_id, desk_ai)?;
    if admin.key != &desk.admin {
        return Err(ScarError::Unauthorized.into());
    }
    require_pda(oracle_ai, &desk.oracle)?;
    let price = read_i64(data, 0)?;
    let expo = read_i32(data, 8)?;
    let mut publish_time = read_i64(data, 16)?;
    let conf = read_u64(data, 24)?;
    if price <= 0 || expo != PRICE_EXPO {
        return Err(ScarError::BadExpo.into());
    }
    let now = Clock::get()?.unix_timestamp;
    if publish_time == 0 {
        publish_time = now;
    }
    let oracle = Oracle {
        source: 1,
        price,
        expo,
        publish_time,
        conf,
    };
    write_bytes(oracle_ai, &oracle_pack(&oracle)?)?;
    msg!("evt=oracle_push;price={};time={}", price, publish_time);
    Ok(())
}

fn set_fixture(program_id: &Pubkey, accounts: &[AccountInfo], data: &[u8]) -> ProgramResult {
    if accounts.len() < 2 || data.len() < 12 {
        return Err(ScarError::BadInstruction.into());
    }
    let admin = &accounts[0];
    let desk_ai = &accounts[1];
    require_signer(admin)?;
    let mut desk = load_desk(program_id, desk_ai)?;
    if admin.key != &desk.admin {
        return Err(ScarError::Unauthorized.into());
    }
    let price = read_i64(data, 0)?;
    let expo = read_i32(data, 8)?;
    if price <= 0 || expo != PRICE_EXPO {
        return Err(ScarError::BadExpo.into());
    }
    desk.fixture_price = price;
    desk.fixture_expo = expo;
    desk.fixture_time = Clock::get()?.unix_timestamp;
    write_desk(desk_ai, &desk)?;
    msg!("evt=fixture;price={}", price);
    Ok(())
}

fn open_position(program_id: &Pubkey, accounts: &[AccountInfo], data: &[u8]) -> ProgramResult {
    if accounts.len() < 7 || data.len() < 13 {
        return Err(ScarError::BadInstruction.into());
    }
    let signer = &accounts[0];
    let owner = &accounts[1];
    let user_ai = &accounts[2];
    let desk_ai = &accounts[3];
    let oracle_ai = &accounts[4];
    let position_ai = &accounts[5];
    let system = &accounts[6];
    require_signer(signer)?;
    require_key(system, &system_program::ID)?;
    let mut desk = load_desk(program_id, desk_ai)?;
    let mut user = load_user(program_id, user_ai)?;
    if owner.key != &user.owner {
        return Err(ScarError::BadOwner.into());
    }
    require_trader(&user, signer)?;
    require_pda(oracle_ai, &desk.oracle)?;
    let side = data[0];
    let fund = data[1];
    let leverage = read_u16(data, 2)?;
    let margin = read_u64(data, 4)?;
    let n_queue = data[12] as usize;
    let nodes = &accounts[7..];
    if nodes.len() != n_queue {
        return Err(ScarError::BadAccount.into());
    }
    if side > SHORT || (fund != FUND_BALANCE && fund != FUND_QUEUED) {
        return Err(ScarError::BadFund.into());
    }
    if leverage == 0 || leverage > desk.max_leverage {
        return Err(ScarError::BadLeverage.into());
    }
    if margin < desk.min_margin {
        return Err(ScarError::BadMargin.into());
    }
    let notional = margin.checked_mul(leverage as u64).ok_or(ScarError::MathOverflow)?;
    let now = Clock::get()?.unix_timestamp;
    let oracle = load_oracle(oracle_ai)?;
    let (entry, source) = resolve_price(&desk, &oracle, now)?;
    let liq = calc_liq(side, entry, leverage, desk.liq_fraction_bps).ok_or(ScarError::MathOverflow)?;
    msg!(
        "evt=price;source={};price={};expo={}",
        if source == 1 { "pyth" } else { "fixture" },
        entry,
        PRICE_EXPO
    );

    if fund == FUND_BALANCE {
        if n_queue != 0 {
            return Err(ScarError::BadFund.into());
        }
        if user.balance < margin {
            return Err(ScarError::InsufficientBalance.into());
        }
        user.balance -= margin;
    } else {
        if user.queued < margin || n_queue == 0 {
            return Err(ScarError::InsufficientQueued.into());
        }
        consume_queued(program_id, &mut desk, &user.owner, nodes, margin)?;
        user.queued = user.queued.checked_sub(margin).ok_or(ScarError::MathOverflow)?;
    }

    let id = user.next_id;
    let id_bytes = id.to_le_bytes();
    let (pda, bump) = Pubkey::find_program_address(
        &[b"pos", owner.key.as_ref(), &id_bytes],
        program_id,
    );
    require_pda(position_ai, &pda)?;
    let bump_s = [bump];
    create_pda(
        signer,
        position_ai,
        system,
        POSITION_SIZE,
        program_id,
        &[&[b"pos", owner.key.as_ref(), &id_bytes, &bump_s]],
    )?;
    let position = Position {
        bump,
        side,
        status: STATUS_OPEN,
        fund_from: fund,
        owner: *owner.key,
        id,
        margin,
        leverage,
        entry_price: entry,
        exit_price: 0,
        notional,
        liq_price: liq,
        pnl: 0,
        fee: 0,
        scar_minted: 0,
        opened_at: now,
        closed_at: 0,
        cash_margin: if fund == FUND_BALANCE { margin } else { 0 },
        queued_margin: if fund == FUND_QUEUED { margin } else { 0 },
        paid_out: 0,
        queued_credit: 0,
    };
    write_position(position_ai, &position)?;
    user.next_id = user.next_id.checked_add(1).ok_or(ScarError::MathOverflow)?;
    user.open_count = user.open_count.checked_add(1).ok_or(ScarError::MathOverflow)?;
    write_user(user_ai, &user)?;
    write_desk(desk_ai, &desk)?;
    msg!(
        "evt=open;pos={};side={};margin={};lev={};entry={};liq={};fund={}",
        id,
        side,
        margin,
        leverage,
        entry,
        liq,
        fund
    );
    Ok(())
}

fn close_positions(program_id: &Pubkey, accounts: &[AccountInfo], data: &[u8]) -> ProgramResult {
    settle_many(program_id, accounts, data, false)
}

fn liquidate(program_id: &Pubkey, accounts: &[AccountInfo], data: &[u8]) -> ProgramResult {
    // Liquidate is a one-position close that MUST be past the liquidation price.
    // Data: n_pay u8, n_new u8, id u64. Keeper signs. Same settlement as close.
    if data.len() < 10 || accounts.len() < 10 {
        return Err(ScarError::BadInstruction.into());
    }
    let n_pay = data[0];
    let n_new = data[1];
    let id = read_u64(data, 2)?;
    let mut rebuilt = vec![1u8, n_pay, n_new, 0];
    rebuilt.extend_from_slice(&id.to_le_bytes());
    settle_many(program_id, accounts, &rebuilt, true)
}

fn settle_many(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    data: &[u8],
    must_liq: bool,
) -> ProgramResult {
    if data.len() < 4 || accounts.len() < 9 {
        return Err(ScarError::BadInstruction.into());
    }
    let n_pos = data[0] as usize;
    let n_pay = data[1] as usize;
    let n_new = data[2] as usize;
    if n_pos == 0 || n_pos > MAX_BATCH {
        return Err(ScarError::BatchLimit.into());
    }
    if data.len() < 4 + n_pos * 8 {
        return Err(ScarError::BadInstruction.into());
    }
    let base = 9usize;
    let need = base + n_pos + n_pay * 2 + n_new;
    if accounts.len() < need {
        return Err(ScarError::BadAccount.into());
    }
    let signer = &accounts[0];
    let owner = &accounts[1];
    let user_ai = &accounts[2];
    let desk_ai = &accounts[3];
    let oracle_ai = &accounts[4];
    let scar_mint = &accounts[5];
    let treasury = &accounts[6];
    let token_program = &accounts[7];
    let system = &accounts[8];
    require_signer(signer)?;
    require_key(token_program, &spl_token::id())?;
    require_key(system, &system_program::ID)?;

    let mut desk = load_desk(program_id, desk_ai)?;
    let mut user = load_user(program_id, user_ai)?;
    if owner.key != &user.owner {
        return Err(ScarError::BadOwner.into());
    }
    if !must_liq {
        require_trader(&user, signer)?;
    }
    require_pda(oracle_ai, &desk.oracle)?;
    require_pda(scar_mint, &desk.scar_mint)?;
    require_pda(treasury, &desk.scar_treasury)?;

    let now = Clock::get()?.unix_timestamp;
    let oracle = load_oracle(oracle_ai)?;
    let (price, source) = resolve_price(&desk, &oracle, now)?;
    msg!(
        "evt=price;source={};price={};expo={}",
        if source == 1 { "pyth" } else { "fixture" },
        price,
        PRICE_EXPO
    );

    let pos_ais = &accounts[base..base + n_pos];
    let pay_raw = &accounts[base + n_pos..base + n_pos + n_pay * 2];
    let new_ais = &accounts[base + n_pos + n_pay * 2..need];

    let mut pay_idx = 0usize;
    let mut new_idx = 0usize;

    for (i, pos_ai) in pos_ais.iter().enumerate() {
        let expect_id = read_u64(data, 4 + i * 8)?;
        let mut position = load_position(program_id, pos_ai)?;
        if position.id != expect_id || position.owner != user.owner {
            return Err(ScarError::BadOwner.into());
        }
        if position.status != STATUS_OPEN {
            return Err(ScarError::PositionNotOpen.into());
        }
        let raw = calc_pnl(position.side, position.entry_price, price, position.notional)
            .ok_or(ScarError::MathOverflow)?;
        let liq = is_liquidatable(position.side, price, position.liq_price);
        if must_liq && !liq {
            return Err(ScarError::NotLiquidatable.into());
        }
        position.exit_price = price;
        position.closed_at = now;
        position.pnl = clamp_i64(raw);

        if liq {
            position.status = STATUS_LIQUIDATED;
            let full_margin = position.margin;
            apply_loss(
                program_id,
                signer,
                user_ai,
                system,
                scar_mint,
                treasury,
                token_program,
                desk_ai,
                &mut desk,
                &mut user,
                &mut position,
                full_margin,
                0,
                pay_raw,
                &mut pay_idx,
                new_ais,
                &mut new_idx,
                now,
            )?;
        } else if raw < 0 {
            position.status = STATUS_CLOSED;
            let capped = if raw <= -(position.margin as i128) {
                position.margin
            } else {
                (-raw) as u64
            };
            let rem = position.margin - capped;
            apply_loss(
                program_id,
                signer,
                user_ai,
                system,
                scar_mint,
                treasury,
                token_program,
                desk_ai,
                &mut desk,
                &mut user,
                &mut position,
                capped,
                rem,
                pay_raw,
                &mut pay_idx,
                new_ais,
                &mut new_idx,
                now,
            )?;
        } else if raw == 0 {
            position.status = STATUS_CLOSED;
            let full_margin = position.margin;
            return_margin(
                program_id,
                signer,
                system,
                &mut desk,
                &mut user,
                &mut position,
                full_margin,
                new_ais,
                &mut new_idx,
                now,
            )?;
        } else {
            position.status = STATUS_CLOSED;
            let pnl_u = u64::try_from(raw).map_err(|_| ScarError::MathOverflow)?;
            apply_win(
                program_id,
                signer,
                system,
                &mut desk,
                &mut user,
                &mut position,
                pnl_u,
                new_ais,
                &mut new_idx,
                now,
            )?;
        }
        user.open_count = user.open_count.saturating_sub(1);
        write_position(pos_ai, &position)?;
        msg!(
            "evt=settle;pos={};status={};pnl={};fee={};paid={};queued={};scar={};src={}",
            position.id,
            position.status,
            position.pnl,
            position.fee,
            position.paid_out,
            position.queued_credit,
            position.scar_minted,
            source
        );
    }

    if new_idx != n_new {
        msg!("evt=bad_new;used={};passed={}", new_idx, n_new);
        return Err(ScarError::BadAccount.into());
    }
    write_user(user_ai, &user)?;
    write_desk(desk_ai, &desk)?;
    Ok(())
}

fn apply_loss<'a>(
    program_id: &Pubkey,
    payer: &AccountInfo<'a>,
    opener_ai: &AccountInfo<'a>,
    system: &AccountInfo<'a>,
    scar_mint: &AccountInfo<'a>,
    treasury: &AccountInfo<'a>,
    token_program: &AccountInfo<'a>,
    desk_ai: &AccountInfo<'a>,
    desk: &mut Desk,
    user: &mut User,
    position: &mut Position,
    loss: u64,
    remaining: u64,
    pay_raw: &[AccountInfo<'a>],
    pay_idx: &mut usize,
    new_ais: &[AccountInfo<'a>],
    new_idx: &mut usize,
    now: i64,
) -> ProgramResult {
    if loss > 0 {
        let scar = scar_for_loss(loss, desk.emission).ok_or(ScarError::MathOverflow)?;
        if scar > 0 {
            mint_scar(program_id, desk_ai, scar_mint, treasury, token_program, scar)?;
            user.scar = user.scar.checked_add(scar).ok_or(ScarError::MathOverflow)?;
            desk.total_scar = desk.total_scar.checked_add(scar).ok_or(ScarError::MathOverflow)?;
            position.scar_minted = scar;
            msg!(
                "evt=scar_minted;user={};amount={};pos={};loss={}",
                user.owner,
                scar,
                position.id,
                loss
            );
        }
    }
    if position.fund_from == FUND_BALANCE {
        user.balance = user.balance.checked_add(remaining).ok_or(ScarError::MathOverflow)?;
        let left = pay_queue(desk, opener_ai, user, loss, pay_raw, pay_idx)?;
        desk.lp_cash = desk.lp_cash.checked_add(left).ok_or(ScarError::MathOverflow)?;
    } else if remaining > 0 {
        let fresh = take_new(new_ais, new_idx)?;
        enqueue(
            program_id,
            payer,
            system,
            desk,
            user,
            &fresh,
            remaining,
            KIND_MARGIN,
            position.id,
            now,
        )?;
        position.queued_credit = position.queued_credit.checked_add(remaining).ok_or(ScarError::MathOverflow)?;
    }
    Ok(())
}

fn return_margin<'a>(
    program_id: &Pubkey,
    payer: &AccountInfo<'a>,
    system: &AccountInfo<'a>,
    desk: &mut Desk,
    user: &mut User,
    position: &mut Position,
    amount: u64,
    new_ais: &[AccountInfo<'a>],
    new_idx: &mut usize,
    now: i64,
) -> ProgramResult {
    if amount == 0 {
        return Ok(());
    }
    if position.fund_from == FUND_BALANCE {
        user.balance = user.balance.checked_add(amount).ok_or(ScarError::MathOverflow)?;
    } else {
        let fresh = take_new(new_ais, new_idx)?;
        enqueue(
            program_id,
            payer,
            system,
            desk,
            user,
            &fresh,
            amount,
            KIND_MARGIN,
            position.id,
            now,
        )?;
        position.queued_credit = position.queued_credit.checked_add(amount).ok_or(ScarError::MathOverflow)?;
    }
    Ok(())
}

fn apply_win<'a>(
    program_id: &Pubkey,
    payer: &AccountInfo<'a>,
    system: &AccountInfo<'a>,
    desk: &mut Desk,
    user: &mut User,
    position: &mut Position,
    pnl: u64,
    new_ais: &[AccountInfo<'a>],
    new_idx: &mut usize,
    now: i64,
) -> ProgramResult {
    let split = split_win(pnl, desk.haircut_bps, desk.lp_free()).ok_or(ScarError::MathOverflow)?;
    position.fee = split.fee_full;
    let full_margin = position.margin;
    return_margin(
        program_id,
        payer,
        system,
        desk,
        user,
        position,
        full_margin,
        new_ais,
        new_idx,
        now,
    )?;
    if split.user_take > 0 {
        if desk.lp_cash < split.user_take {
            return Err(ScarError::InsufficientLp.into());
        }
        desk.lp_cash -= split.user_take;
        user.balance = user.balance.checked_add(split.user_take).ok_or(ScarError::MathOverflow)?;
        position.paid_out = split.user_take;
    }
    if split.fee_take > 0 {
        desk.pending_fees = desk.pending_fees.checked_add(split.fee_take).ok_or(ScarError::MathOverflow)?;
        desk.reserved_fees = desk.reserved_fees.checked_add(split.fee_take).ok_or(ScarError::MathOverflow)?;
        flush_acc(desk)?;
    }
    if split.shortfall > 0 {
        let fresh = take_new(new_ais, new_idx)?;
        enqueue(
            program_id,
            payer,
            system,
            desk,
            user,
            &fresh,
            split.shortfall,
            KIND_PROFIT,
            position.id,
            now,
        )?;
        position.queued_credit = position
            .queued_credit
            .checked_add(split.shortfall)
            .ok_or(ScarError::MathOverflow)?;
    }
    Ok(())
}

fn pay_queue<'a>(
    desk: &mut Desk,
    opener_ai: &AccountInfo<'a>,
    opener: &mut User,
    mut cash: u64,
    pay_raw: &[AccountInfo<'a>],
    pay_idx: &mut usize,
) -> Result<u64, ProgramError> {
    if cash == 0 || desk.queue_len == 0 {
        return Ok(cash);
    }
    let mut expect = desk.queue_head;
    while cash > 0 && *pay_idx + 1 < pay_raw.len() {
        let node_ai = &pay_raw[*pay_idx];
        let cred_ai = &pay_raw[*pay_idx + 1];
        *pay_idx += 2;
        if node_ai.owner != opener_ai.owner {
            return Err(ScarError::BadQueueNode.into());
        }
        let mut node = QueueNode::unpack(&node_ai.data.borrow())?;
        if node.index != expect {
            return Err(ScarError::BadQueueNode.into());
        }
        if node.remaining == 0 {
            expect = expect.checked_add(1).ok_or(ScarError::MathOverflow)?;
            desk.queue_head = expect;
            continue;
        }
        let pay = cash.min(node.remaining);
        if cred_ai.key == opener_ai.key {
            if opener.owner != node.owner || opener.queued < pay {
                return Err(ScarError::BadQueueNode.into());
            }
            opener.balance = opener.balance.checked_add(pay).ok_or(ScarError::MathOverflow)?;
            opener.queued -= pay;
        } else {
            if cred_ai.owner != opener_ai.owner {
                return Err(ScarError::BadAccount.into());
            }
            let mut cred = User::unpack(&cred_ai.data.borrow())?;
            if cred.owner != node.owner || cred.queued < pay {
                return Err(ScarError::BadQueueNode.into());
            }
            cred.balance = cred.balance.checked_add(pay).ok_or(ScarError::MathOverflow)?;
            cred.queued -= pay;
            write_user(cred_ai, &cred)?;
        }
        node.remaining -= pay;
        cash -= pay;
        if node.remaining == 0 {
            node.status = NODE_PAID;
            desk.queue_len = desk.queue_len.checked_sub(1).ok_or(ScarError::MathOverflow)?;
            expect = expect.checked_add(1).ok_or(ScarError::MathOverflow)?;
            desk.queue_head = expect;
        }
        {
            let mut buf = node_ai.data.borrow_mut();
            node.pack(&mut buf);
        }
        msg!("evt=queue_pay;index={};amount={};user={}", node.index, pay, node.owner);
        // Leave the partial head available for a later settle in this transaction.
        if node.remaining > 0 {
            *pay_idx -= 2;
            break;
        }
    }
    if cash > 0 && desk.queue_len > 0 {
        msg!("evt=queue_short;cash={};len={}", cash, desk.queue_len);
        return Err(ScarError::QueueRequired.into());
    }
    Ok(cash)
}

fn consume_queued(
    program_id: &Pubkey,
    desk: &mut Desk,
    owner: &Pubkey,
    nodes: &[AccountInfo],
    margin: u64,
) -> ProgramResult {
    let mut need = margin;
    for node_ai in nodes {
        if node_ai.owner != program_id {
            return Err(ScarError::BadQueueNode.into());
        }
        let mut node = QueueNode::unpack(&node_ai.data.borrow())?;
        if node.owner != *owner || node.status != NODE_ACTIVE || node.remaining == 0 {
            return Err(ScarError::BadQueueNode.into());
        }
        if need == 0 {
            return Err(ScarError::BadQueueNode.into());
        }
        let take = need.min(node.remaining);
        node.remaining -= take;
        need -= take;
        if node.remaining == 0 {
            node.status = NODE_PAID;
            desk.queue_len = desk.queue_len.checked_sub(1).ok_or(ScarError::MathOverflow)?;
        }
        {
            let mut buf = node_ai.data.borrow_mut();
            node.pack(&mut buf);
        }
        msg!("evt=queue_consume;index={};amount={}", node.index, take);
    }
    if need != 0 {
        return Err(ScarError::InsufficientQueued.into());
    }
    let mut head = desk.queue_head;
    loop {
        let mut advanced = false;
        for node_ai in nodes {
            let node = QueueNode::unpack(&node_ai.data.borrow())?;
            if node.index == head && node.remaining == 0 {
                head = head.checked_add(1).ok_or(ScarError::MathOverflow)?;
                advanced = true;
                break;
            }
        }
        if !advanced {
            break;
        }
    }
    desk.queue_head = head;
    Ok(())
}

fn enqueue<'a>(
    program_id: &Pubkey,
    payer: &AccountInfo<'a>,
    system: &AccountInfo<'a>,
    desk: &mut Desk,
    user: &mut User,
    new_ai: &AccountInfo<'a>,
    amount: u64,
    kind: u8,
    position_id: u64,
    now: i64,
) -> ProgramResult {
    if amount == 0 {
        return Ok(());
    }
    let index = desk.queue_tail;
    let index_bytes = index.to_le_bytes();
    let (pda, bump) = Pubkey::find_program_address(&[b"q", &index_bytes], program_id);
    require_pda(new_ai, &pda)?;
    let bump_s = [bump];
    create_pda(
        payer,
        new_ai,
        system,
        QUEUE_SIZE,
        program_id,
        &[&[b"q", &index_bytes, &bump_s]],
    )?;
    let node = QueueNode {
        bump,
        status: NODE_ACTIVE,
        kind,
        owner: user.owner,
        index,
        total: amount,
        remaining: amount,
        position_id,
        enqueued_at: now,
    };
    write_bytes(new_ai, &queue_pack(&node)?)?;
    desk.queue_tail = desk.queue_tail.checked_add(1).ok_or(ScarError::MathOverflow)?;
    desk.queue_len = desk.queue_len.checked_add(1).ok_or(ScarError::MathOverflow)?;
    user.queued = user.queued.checked_add(amount).ok_or(ScarError::MathOverflow)?;
    msg!(
        "evt=queue_write;index={};amount={};pos={};kind={};user={}",
        index,
        amount,
        position_id,
        kind,
        user.owner
    );
    Ok(())
}

fn mint_scar<'a>(
    program_id: &Pubkey,
    desk_ai: &AccountInfo<'a>,
    scar_mint: &AccountInfo<'a>,
    treasury: &AccountInfo<'a>,
    token_program: &AccountInfo<'a>,
    amount: u64,
) -> ProgramResult {
    let (desk_pda, bump) = Pubkey::find_program_address(&[b"desk"], program_id);
    require_pda(desk_ai, &desk_pda)?;
    let bump_s = [bump];
    let seeds: &[&[u8]] = &[b"desk", &bump_s];
    invoke_signed(
        &spl_token::instruction::mint_to(
            &spl_token::id(),
            scar_mint.key,
            treasury.key,
            desk_ai.key,
            &[],
            amount,
        )?,
        &[
            scar_mint.clone(),
            treasury.clone(),
            desk_ai.clone(),
            token_program.clone(),
        ],
        &[seeds],
    )?;
    Ok(())
}

fn stake(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    data: &[u8],
    staking: bool,
) -> ProgramResult {
    if accounts.len() < 3 {
        return Err(ScarError::BadInstruction.into());
    }
    let signer = &accounts[0];
    let user_ai = &accounts[1];
    let desk_ai = &accounts[2];
    require_signer(signer)?;
    let mut desk = load_desk(program_id, desk_ai)?;
    let mut user = load_user(program_id, user_ai)?;
    require_owner(&user, signer, if staking { "stake" } else { "unstake" })?;
    let amount = read_u64(data, 0)?;
    if amount == 0 {
        return Err(ScarError::AmountZero.into());
    }
    harvest(&mut desk, &mut user)?;
    if staking {
        let free = user.scar.checked_sub(user.staked).ok_or(ScarError::MathOverflow)?;
        if free < amount {
            return Err(ScarError::InsufficientScar.into());
        }
        user.staked = user.staked.checked_add(amount).ok_or(ScarError::MathOverflow)?;
        desk.total_staked = desk.total_staked.checked_add(amount).ok_or(ScarError::MathOverflow)?;
        msg!("evt=stake;amount={};staked={}", amount, user.staked);
    } else {
        if user.staked < amount {
            return Err(ScarError::InsufficientScar.into());
        }
        user.staked -= amount;
        desk.total_staked = desk.total_staked.checked_sub(amount).ok_or(ScarError::MathOverflow)?;
        msg!("evt=unstake;amount={};staked={}", amount, user.staked);
    }
    user.reward_debt = (user.staked as u128)
        .checked_mul(desk.acc_reward)
        .ok_or(ScarError::MathOverflow)?
        / SCALE;
    write_user(user_ai, &user)?;
    write_desk(desk_ai, &desk)?;
    Ok(())
}

fn claim(program_id: &Pubkey, accounts: &[AccountInfo]) -> ProgramResult {
    if accounts.len() < 3 {
        return Err(ScarError::BadInstruction.into());
    }
    let signer = &accounts[0];
    let user_ai = &accounts[1];
    let desk_ai = &accounts[2];
    require_signer(signer)?;
    let mut desk = load_desk(program_id, desk_ai)?;
    let mut user = load_user(program_id, user_ai)?;
    require_owner(&user, signer, "claim")?;
    harvest(&mut desk, &mut user)?;
    let pay = user.claimable;
    if pay == 0 {
        return Err(ScarError::NothingToClaim.into());
    }
    if desk.reserved_fees < pay || desk.lp_cash < pay {
        return Err(ScarError::InsufficientLp.into());
    }
    desk.reserved_fees -= pay;
    desk.lp_cash -= pay;
    user.balance = user.balance.checked_add(pay).ok_or(ScarError::MathOverflow)?;
    user.claimable = 0;
    write_user(user_ai, &user)?;
    write_desk(desk_ai, &desk)?;
    msg!("evt=claim;amount={};user={}", pay, user.owner);
    Ok(())
}

fn harvest(desk: &mut Desk, user: &mut User) -> ProgramResult {
    flush_acc(desk)?;
    let accrued = (user.staked as u128)
        .checked_mul(desk.acc_reward)
        .ok_or(ScarError::MathOverflow)?
        / SCALE;
    if accrued > user.reward_debt {
        let delta = (accrued - user.reward_debt) as u64;
        user.claimable = user.claimable.checked_add(delta).ok_or(ScarError::MathOverflow)?;
    }
    user.reward_debt = accrued;
    Ok(())
}

fn flush_acc(desk: &mut Desk) -> ProgramResult {
    if desk.total_staked == 0 || desk.pending_fees == 0 {
        return Ok(());
    }
    let total = desk.total_staked as u128;
    let pending = desk.pending_fees as u128;
    let add = pending.checked_mul(SCALE).ok_or(ScarError::MathOverflow)? / total;
    let consumed = add.checked_mul(total).ok_or(ScarError::MathOverflow)? / SCALE;
    desk.acc_reward = desk.acc_reward.checked_add(add).ok_or(ScarError::MathOverflow)?;
    desk.pending_fees -= consumed as u64;
    Ok(())
}

fn resolve_price(desk: &Desk, oracle: &Oracle, now: i64) -> Result<(i64, u8), ProgramError> {
    let fresh = oracle.price > 0
        && oracle.expo == PRICE_EXPO
        && oracle.publish_time > 0
        && oracle.publish_time <= now.saturating_add(5)
        && now.saturating_sub(oracle.publish_time) <= desk.oracle_max_age as i64;
    if fresh {
        return Ok((oracle.price, 1));
    }
    if desk.fixture_price > 0 && desk.fixture_expo == PRICE_EXPO {
        return Ok((desk.fixture_price, 2));
    }
    Err(ScarError::BadPrice.into())
}

fn require_signer(ai: &AccountInfo) -> ProgramResult {
    if ai.is_signer {
        Ok(())
    } else {
        Err(ScarError::Unauthorized.into())
    }
}

fn require_key(ai: &AccountInfo, key: &Pubkey) -> ProgramResult {
    if ai.key == key {
        Ok(())
    } else {
        Err(ScarError::BadAccount.into())
    }
}

fn require_pda(ai: &AccountInfo, pda: &Pubkey) -> ProgramResult {
    if ai.key == pda {
        Ok(())
    } else {
        Err(ScarError::BadAccount.into())
    }
}

fn require_owner(user: &User, signer: &AccountInfo, op: &str) -> ProgramResult {
    if !signer.is_signer {
        return Err(ScarError::Unauthorized.into());
    }
    if signer.key == &user.owner {
        return Ok(());
    }
    if user.has_session == 1 && signer.key == &user.session {
        msg!("evt=session_reject;op={}", op);
        return Err(ScarError::SessionForbidden.into());
    }
    Err(ScarError::Unauthorized.into())
}

fn require_trader(user: &User, signer: &AccountInfo) -> ProgramResult {
    if !signer.is_signer {
        return Err(ScarError::Unauthorized.into());
    }
    if signer.key == &user.owner {
        return Ok(());
    }
    if user.has_session == 1 && signer.key == &user.session {
        return Ok(());
    }
    Err(ScarError::Unauthorized.into())
}

fn load_desk(program_id: &Pubkey, ai: &AccountInfo) -> Result<Desk, ProgramError> {
    if ai.owner != program_id {
        return Err(ScarError::BadAccount.into());
    }
    Desk::unpack(&ai.data.borrow())
}

fn load_user(program_id: &Pubkey, ai: &AccountInfo) -> Result<User, ProgramError> {
    if ai.owner != program_id {
        return Err(ScarError::BadAccount.into());
    }
    User::unpack(&ai.data.borrow())
}

fn load_position(program_id: &Pubkey, ai: &AccountInfo) -> Result<Position, ProgramError> {
    if ai.owner != program_id {
        return Err(ScarError::BadAccount.into());
    }
    Position::unpack(&ai.data.borrow())
}

fn load_oracle(ai: &AccountInfo) -> Result<Oracle, ProgramError> {
    Oracle::unpack(&ai.data.borrow())
}

fn write_desk(ai: &AccountInfo, desk: &Desk) -> ProgramResult {
    let packed = desk_pack(desk)?;
    write_bytes(ai, &packed)
}

fn write_user(ai: &AccountInfo, user: &User) -> ProgramResult {
    let packed = user_pack(user)?;
    write_bytes(ai, &packed)
}

fn write_position(ai: &AccountInfo, position: &Position) -> ProgramResult {
    let packed = position_pack(position)?;
    write_bytes(ai, &packed)
}

fn desk_pack(desk: &Desk) -> Result<Vec<u8>, ProgramError> {
    let mut buf = vec![0u8; DESK_SIZE];
    desk.pack(&mut buf);
    Ok(buf)
}
fn user_pack(user: &User) -> Result<Vec<u8>, ProgramError> {
    let mut buf = vec![0u8; USER_SIZE];
    user.pack(&mut buf);
    Ok(buf)
}
fn position_pack(position: &Position) -> Result<Vec<u8>, ProgramError> {
    let mut buf = vec![0u8; POSITION_SIZE];
    position.pack(&mut buf);
    Ok(buf)
}
fn oracle_pack(oracle: &Oracle) -> Result<Vec<u8>, ProgramError> {
    let mut buf = vec![0u8; ORACLE_SIZE];
    oracle.pack(&mut buf);
    Ok(buf)
}
fn queue_pack(node: &QueueNode) -> Result<Vec<u8>, ProgramError> {
    let mut buf = vec![0u8; QUEUE_SIZE];
    node.pack(&mut buf);
    Ok(buf)
}

fn write_bytes(ai: &AccountInfo, bytes: &[u8]) -> ProgramResult {
    let mut data = ai.try_borrow_mut_data()?;
    if data.len() < bytes.len() {
        return Err(ScarError::BadAccount.into());
    }
    data[..bytes.len()].copy_from_slice(bytes);
    Ok(())
}

fn create_pda<'a>(
    payer: &AccountInfo<'a>,
    account: &AccountInfo<'a>,
    system: &AccountInfo<'a>,
    space: usize,
    owner: &Pubkey,
    signers: &[&[&[u8]]],
) -> ProgramResult {
    if !account.data_is_empty() {
        return Err(ScarError::AlreadyInitialized.into());
    }
    let rent = Rent::get()?;
    let lamports = rent.minimum_balance(space);
    invoke_signed(
        &system_instruction::create_account(payer.key, account.key, lamports, space as u64, owner),
        &[payer.clone(), account.clone(), system.clone()],
        signers,
    )?;
    Ok(())
}

fn read_u16(data: &[u8], at: usize) -> Result<u16, ProgramError> {
    let s = data.get(at..at + 2).ok_or(ScarError::BadInstruction)?;
    Ok(u16::from_le_bytes(s.try_into().unwrap()))
}
fn read_u64(data: &[u8], at: usize) -> Result<u64, ProgramError> {
    let s = data.get(at..at + 8).ok_or(ScarError::BadInstruction)?;
    Ok(u64::from_le_bytes(s.try_into().unwrap()))
}
fn read_i32(data: &[u8], at: usize) -> Result<i32, ProgramError> {
    let s = data.get(at..at + 4).ok_or(ScarError::BadInstruction)?;
    Ok(i32::from_le_bytes(s.try_into().unwrap()))
}
fn read_i64(data: &[u8], at: usize) -> Result<i64, ProgramError> {
    let s = data.get(at..at + 8).ok_or(ScarError::BadInstruction)?;
    Ok(i64::from_le_bytes(s.try_into().unwrap()))
}

fn take_new<'a>(
    new_ais: &[AccountInfo<'a>],
    new_idx: &mut usize,
) -> Result<AccountInfo<'a>, ProgramError> {
    let ai = new_ais.get(*new_idx).ok_or(ScarError::BadAccount)?;
    *new_idx += 1;
    Ok(ai.clone())
}

fn clamp_i64(v: i128) -> i64 {
    if v > i64::MAX as i128 {
        i64::MAX
    } else if v < i64::MIN as i128 {
        i64::MIN
    } else {
        v as i64
    }
}
