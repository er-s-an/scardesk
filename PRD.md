# PRD — Colosseum remake of papertrade.xyz（Solana）

| 字段 | 值 |
| --- | --- |
| 产品工作名 | **Scardesk**（loss-token **SCAR** · repo `scardesk`；**禁止**冒充 papertrade.xyz） |
| 文档核对 | 2026-10-12 ~00:35 HKT（含 FIDELITY 抬标） |
| 赛场 | Colosseum Crypto World's Fair · Solana track + 总池 |
| 截止 | **2026-10-13 14:59 HKT**（= 2026-10-12 23:59 PT） |
| 报名费 | **免费** |
| 阶段 | **已点头 · Build 中**；范围见 `FIDELITY.md`（全复刻抬标）；**禁止 makebook** |
| Lane | 双视频 **继续**；**不 Submit**；**不切换** Paychannel Build 代码 |
| 研究底稿 | `./RESEARCH.md` · 纠正说明 `../colosseum-cwf/AGENT-PAPERTRADE-CORRECTION.md` |
| 商业标签 | **experimental**（零访谈；不装已有付费客户） |
| UI 色系 | **红 / 黑（red–black）** — 用户指定 |

---

## ⚠ 产品纠正（读前必看）

**正确参考产品：** [papertrade.xyz](https://papertrade.xyz) — Hyperliquid / HyperEVM 上的 **合成永续 + loss mining + FIFO 派彩队列**。  

**错误旧框：** Alpaca / TradingView / Conviction「模拟资金 paper trading」。旧一句话与旧工具表作废。详见 CORRECTION 文档。

---

## 1. 一句话（纠正后）

给 Solana 一条 **papertrade.xyz 式机制**：agent（或人）用真实结算规则开 **合成高杠杆仓** → 对 **自举 LP** 结算 → 赢可能进 **FIFO 队列** → 亏铸造 **loss-token** 并可质押分协议收入；价格锚定 **Solana 预言机**（Pyth / Switchboard 等，见开放问题）；账本与队列 **链上可读**。

英文评委可说：  
*A Solana remake of papertrade.xyz — Martingaler LP, loss-mint, FIFO payouts, session-key agents (trade≠withdraw); oracle via Pyth/Switchboard; tools shaped like Circuit’s wrapper — no HL contract fork.*

---

## 2. 为什么做（问题 / 非问题）

### 2.1 要解决的行为问题
- papertrade.xyz 证明「亏损即所有权 + 队列化解暂时资不抵债」是可演示的 **特殊机制**；本场需要 **Solana 可见** 版本，而不是再做一个聊天刷假 P&L 的 agent desk。
- Agent 若只能「说多空」，评委看不到 **开仓 → 结算 → 铸币/排队** 的强制工具环。

### 2.2 明确不是
- ❌ 模拟资金 paper trading（Alpaca 式）  
- ❌ 再造 Hyperliquid CLOB 或 Jupiter 现货聚合器本身  
- ❌ 冒充 / 换皮 papertrade.xyz（**禁止 makebook**；新品牌新仓）  
- ❌ 通用「AI 交易助手」壳  

### 2.3 本场硬杠对齐
1. Agent 工具一响就 **改仓 / 改 LP / 改队列 / 铸 loss-token**（规则真实，可审计）。  
2. 状态 **Solana 可指**（explorer：仓位 PDA、LP、queue head、mint 事件）。  
3. 关掉 Solana program = **同一结算环不成立**。  
4. 无报名费；禁止 makebook；点头前不 Build。

---

## 3. 用户与场景

| 角色 | 场景（MVP） | 成功标准 |
| --- | --- | --- |
| **演示操作者**（你 / 小可） | 3 分钟：入金 → agent/人手开仓 → 强制亏损路径铸币 **或** 赢利进队列 → 指 explorer | Demo 可复现 |
| **评委** | 听懂「不是假 P&L」且「不是 Alpaca paper」 | 能复述：合成仓·自举 LP·FIFO·loss mint |
| **Agent 开发者**（experimental） | 用 Circuit 形工具跑策略 | 文档级 API；本场不验证付费 |

---

## 4. 核心产品环（必须特殊）

```
公允价（Jupiter/…）→ Agent/人手 open(isolated) → 持仓盯价
    → close / liquidate
         ├─ 亏损：margin→LP；mint loss-token；可选 stake
         └─ 盈利：impact/fee 后尽力兑付；不足 → FIFO queue（margin 先退）
    → UI（红黑）刷新 balance / queued / PAPER* / queue
    → Solana 账户字段可被 explorer 指认
```

\*本场 loss-token 锁定 **SCAR**（下文若仍见 LOSS 占位，一律按 SCAR）。

### 4.1 Agent 工具集（MVP · 镜像 Circuit 实有面）

权威形状来自 Circuit docs（https://docs.circuit.org/agent-developers/sdk-reference/papertrade），**语义同构、实现换栈**：

| 工具 | 作用 | 副作用 |
| --- | --- | --- |
| `positions.open({ asset, side, margin, leverage, fundFrom? })` | 开孤立合成仓 | 锁 margin；写 position PDA |
| `positions.close({ positionIds })` | 平仓（限批量） | 结算 PnL；可能 mint LOSS / 入队 |
| `positions.closed({ positionIds })` | 查询已平结果 | 只读 |
| `account.retrieve()` | balance / queued / positions / loss-token | 只读 |
| `paper.stake` / `paper.unstake` / `paper.claim` | 质押 LOSS、领收益 | 改 stake 与奖励账户 |
| （可选人手）Order ticket 同参 | 同一 settlement 路径 | 同左 |

**硬规则：** 模型 **没有** `set_balance` / `set_pnl` / `mint_free_token`。任何余额与铸币必须经结算引擎。

### 4.2 结算引擎（评委可念 · 参数档见开放问题）

1. **开仓价 / 平仓价** = 文档化预言机 mid（候选：**Pyth / Switchboard** — **用户钉**；非 HL BBO）。  
2. **孤立仓**：固定 margin + leverage；MVP **不对齐** partial close / margin top-up（对齐 Circuit）。  
3. **亏损 / 清算**：损失进 LP；按排放曲线 mint LOSS（曲线常数 Build 前再核官方；MVP 可用简化表但须写进 README）。  
4. **盈利**：先应用公开的 win haircut/fee 规则（若官方参数未核清，MVP 用 **简化常数表** 并标注 *provisional*）；LP 够则付；不够则 **margin 退、利润 FIFO**。  
5. **队列**：后续流入优先偿还 queue head，再增长 LP。  
6. **Stake**：staked LOSS 分协议收入（MVP 可先做「fee 累计可 claim」最小环）。

### 4.3 Solana 可见状态（反壳）

最低要让评委指到：
- 用户 margin / balance 账户  
- 每笔 position（entry、leverage、liq 相关字段）  
- LP vault 余额  
- queue 节点（或队列账户 + head/tail）  
- LOSS mint 供应与用户余额 / stake  

网络：Surfnet / devnet / 其它 → 开放问题。

### 4.4 Session key（必须）
- Agent 使用 **session key**：可 `open`/`close`（及文档允许的交易意图），**不能 withdraw**。
- 提现 / 权限分离必须在 Solana 程序或账户模型里可见（评委可讲「trade key ≠ vault authority」）。
- 对齐原版产品安全叙事；实现自建，不抄未公开 intent schema。

### 4.5 明确禁止
- **禁止 fork / 移植 Hyperliquid 或 HyperEVM 合约代码**（makebook + 错误栈）。
- **禁止**声称已对接 papertrade 官方 REST/relayer（地址 TBA、intent 未公开）。
- Circuit / paperpad 仅作 **模式参考**，非依赖。


---

## 5. Deltas vs Hyperliquid 原版（必须标明）

| 维度 | papertrade.xyz（原） | 本场 Colosseum remake |
| --- | --- | --- |
| 链 / 运行时 | HyperEVM + Hyperliquid precompile | **Solana program** |
| 价格源 | Hyperliquid **BBO mid** | **Pyth / Switchboard**（等，待钉；非 HL precompile） |
| 资产 | BTC / ETH（Circuit） | **SOL 生态标的**（待钉；建议极少品种） |
| 稳定币轨 | Papertrade USDC ↔ HyperCore | **Solana USDC**（或 demo mint — 待钉） |
| Agent 接入 | Circuit（**第三方** wrapper）/ 官方 relayer（**未公开**） | **自建** session-key（可交易不可提现）+ 同构工具面；**不 fork HL**；不依赖未公开 relayer |
| 品牌 / 代币 | PAPER（不可转让） | **新品牌 + 新 loss-token 名**（禁冒充） |
| UI | 原站（未完整抓到视觉） | **红黑** 色系桌面 |
| LP / 队列 / loss mint | Martingaler + FIFO + PAPER | **机制同构**；参数可简化但行为不删 |
| 范围 | 主网真实 USDC venue | 黑客松 **MVP 演示环**；合规与资金档用户钉 |

---

## 6. UX（红黑）

- **底：** 近黑背景；**强调 / 涨跌 / 危险：** 红色系（具体涨跌语义见开放问题：红仅品牌，或红=涨/亏高亮）。  
- 首屏模块：Account（balance · queued）｜ Open ticket｜ Positions｜ Queue｜ LOSS stake/claim｜ Agent activity log。  
- 亏损平仓：强反馈「LOSS minted」。  
- 队列：可视化「你的排队利润 / 队首距离」。  
- 文案必须出现：**Synthetic perps · Loss-funded LP · FIFO payouts** — 禁止写 “paper trading simulator”。

---

## 7. 范围边界（2026-10-12 抬标 · 见 `FIDELITY.md`）

**做（功能环全复刻，非薄壳）：**
- SOL/USD 孤立开平仓、清算、自举 LP、FIFO、SCAR mint+stake+claim、`fundFrom: queued`  
- Agent 工具面（上表）+ **session-key 不可提现**（亦不可 stake/claim）+ 人手 Order Ticket（同结算路径）  
- Solana 可读状态（Surfnet/devnet）+ **UX 流全复刻** + 红黑自有风格  
- README：价格公式、排放简化表（*provisional*）、与原版 delta  

**不做（本场）：**
- 未核清治理参数逐字当 official；像素抄原站  
- Fork HL/HyperEVM 或假装官方 relayer；跨链桥 Hyperliquid  
- 任意多市场 / 社交跟单 / 移动端 / 主网真 USDC  
- makebook；Lane Submit（直至另令）

---

## 8. 非目标与风险披露语气

- 标 **experimental**；页脚：「高杠杆合成衍生品机制演示；非投顾；可能亏损本金；队列兑付依赖后续流入。」  
- 不宣称与 papertrade.xyz 官方有关。

---

## 9. 成功标准（Demo）

1. 评委能复述机制四件套：合成仓 / 自举 LP / FIFO / loss mint。  
2. Explorer 能指到至少一次 mint 或一次 queue 写入。  
3. Agent 一次 `open`→`close` 全程无「直接改余额」工具。  
4. UI 明显红黑；文案无 Alpaca-paper 误导。

---

## 10. 开放问题入口

见 `./OPEN-QUESTIONS.md` · **`./FIDELITY.md`**（必须对齐 / 可简化）。Build 已开；范围以 FIDELITY+LOCK 为准。
