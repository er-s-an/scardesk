# RESEARCH — papertrade.xyz 机制 / UX / Circuit SDK（Colosseum remake 底稿）

核对：2026-10-11 ~23:55 HKT（含 Cooper verified brief）。  
**CRITICAL CORRECTION：** 本目录先前把「papertrade」误写成 **Alpaca / TradingView 风格纸面交易**。那是 **WRONG-PRODUCT**。正确产品是 **https://papertrade.xyz**（Hyperliquid 上的 **synthetic perps + loss mining**）。  
用途：可抄机制 + Circuit agent SDK 实有方法。**不发明功能**；官方 docs 站点首页仅返回标题时标 **PARTIAL**；第三方综述标 **SECONDARY**。  
本场：Colosseum Crypto World's Fair；截止 **2026-10-13 14:59 HKT**；免费；**禁止 makebook**；**PRD 点头前不 Build**；Lane：**不 Submit**。

---

## 0) 一句话（纠正后）

**papertrade.xyz = 在 HyperEVM 上、用 Hyperliquid BBO mid 定价的合成永续；对手方是自举 LP（从亏损/清算长出来）；赢家可能进 FIFO 派彩队列；亏损铸造不可转让的 PAPER，质押赚 USDC。**

**不是：** 模拟资金 paper trading、Alpaca paper API、TradingView paper、Conviction/Scalar「回测→paper→live」漏斗。

---


## 0.5) Cooper verified brief（已 ingest · 2026-10-11）

不发明超出下列 + 已抓源交叉验证：

| 点 | 内容 | 确认 |
| --- | --- | --- |
| 品类 | HyperEVM **synthetic perps vs protocol LP**（**无 orderbook**） | 官网 + Circuit + paperpad |
| 定价 | HL **BBO mid** | Circuit + paperpad |
| 市场 | 至 **1000×** · **BTC/ETH** | Circuit + paperpad |
| Loss mining | 亏损铸 **$PAPER** 以 bootstrap LP | 多源 |
| 兑付 | 赢家利润进 **FIFO payout queue** | 白纸队列逻辑 + Circuit `queued` + paperpad |
| Session key | **可交易，不可提现** | paperpad 表：session 签 open/close intents；**cannot withdraw**（paperpad 另写 cannot stake/claim — Circuit 文档则暴露 stake/claim，属其 wrapper 权限面，以「不可提现」为硬核） |
| 融资叙事 | **无公开 VC round 声称**；fair launch、**无 VC allocation**（≠「公司零资金」） | Cooper；与 PAPER 无 team/VC 分配叙事一致 |
| 官方集成门槛 | **公开 docs**；**合约地址 TBA**；**intent/relayer 未公开**；**无官方 REST / 无官方 GitHub**（截至 brief） | paperpad：「intent schema, relayer endpoint and contract addresses are unpublished」；TechFlow 等同向报道 |
| Circuit | **第三方** agent wrapper，非官方 venue SDK | Cooper；Circuit 自托管 session |
| paperpad | https://paperpad.trade/docs 亦在等 relay | **VERIFIED** fetch |
| 本场硬约束 | **禁止 fork HL/HyperEVM 合约**；机制 port 到 **Solana program** | Cooper / 用户 |

**Primary sources（优先）：** papertrade.xyz · docs.papertrade.xyz · martingaler-whitepaper.pdf  

**Agent 现状含义：** 外部不能合法直连未公开 relayer → Colosseum remake 必须 **自建 Solana 结算 + 自有 session-key 权限模型**，只 **抄 Circuit 工具面形状**，不假装已有 papertrade 官方 API。

---

## 1) 官方 / 一手源（已抓）

| 源 | URL | 状态 | 拿到什么 |
| --- | --- | --- | --- |
| 官网 | https://papertrade.xyz | **VERIFIED** | 「Synthetic perpetuals on Hyperliquid」；口号：1000x · 0 market impact · 100% user owned · fully onchain on hyperliquid |
| 官方 docs | https://docs.papertrade.xyz/ | **PARTIAL** | WebFetch 仅返回「Papertrade Docs」标题；细节以白纸/二手交叉为准 |
| Martingaler 白纸 | https://docs.papertrade.xyz/martingaler-whitepaper.pdf | **VERIFIED** | 通用「无初始 LP + payout queue + SRI + token emissions」机制文（Jez/Blurr）；抽象层，非 Solana 实现规格 |
| Circuit SDK | https://docs.circuit.org/agent-developers/sdk-reference/papertrade | **VERIFIED · 第三方** | Agent wrapper（**非** papertrade 官方 SDK）；real USDC；session key 自注册 |
| paperpad docs | https://paperpad.trade/docs | **SECONDARY** | 第三方 agent 平台；确认 session key **可交易不可提现**；**intent/relayer/合约地址 unpublished**；自述在等 Papertrade relay |
| Circuit llms.txt | https://docs.circuit.org/llms.txt | **VERIFIED** | Papertrade 条目：Trade isolated synthetic perpetuals and stake PAPER |
| Bankless | https://www.bankless.com/read/papertrade-turns-liquidations-into-ownership | **SECONDARY** | 机制叙事综述（@izebel_eth / HyperEVM / loss rebate PAPER / FIFO） |
| CryptoWay | https://cryptoway.io/guides/papertrade-exchange-explained/ | **SECONDARY** | BBO mid、Martingaler、FIFO、PAPER emissions、trackedLpUsd 细节 |
| Sumcap | https://www.sumcap.xyz/blog/the-house-always-wins | **SECONDARY** | 非官方模拟文；含 asymmetric impact 公式、队列、emission 叙述；**impact 曲线参数自称借 Rollbit，非 Papertrade 已公开校准** → 参数勿当官方钉死 |
| PaperJet 旁注 | https://docs.paperjet.world/papertrade | **SECONDARY** | 澄清 PaperJet ≠ papertrade；复述合成 swap / PAPER / queue |
| paperdao docs | https://paperdao.vercel.app/docs/ | **SECONDARY** | 独立金库项目；声称「from papertrade's published docs」复述 mint 公式；**非 papertrade 官方** |

---

## 2) 核心机制（只写可交叉验证的）

### 2.1 产品形
- **合成永续（synthetic perps）**：仓位在 Papertrade 自有合约（HyperEVM）内，对 **协议 LP** 做合成 swap；**不是**在 Hyperliquid CLOB 上开真实 HL perp。
- **定价**：读 Hyperliquid **BBO mid**（best bid/ask 中点）作开/平仓价。Circuit：settles at Hyperliquid's order-book mid。
- **杠杆**：最高 **1000×**（官网页 + Circuit）。
- **无传统订单簿 / 无 resting orders**：Circuit：no order book, spread, slippage or funding；isolated position；**无部分平仓、无追加保证金**。
- **真实 USDC**：Circuit 明确 real USDC（与模拟 paper 无关）。

### 2.2 对手方 = 自举 LP（Martingaler）
- LP **从 $0 起**；用户 **不能** 直接存 LP 做市（Bankless / CryptoWay / PaperJet 一致）。
- LP 增长来源：交易者 **已实现亏损**、**清算**、以及对盈利平仓施加的 **impact / fee**（SECONDARY 细节）。
- 用户对 LP 经济的暴露唯一路径：**亏损铸造 PAPER → 质押**。

### 2.3 FIFO 派彩队列（payout queue）
- LP 不够付赢家时：**保证金退回**；**未付利润**进 **FIFO** 队列（Bankless / CryptoWay / Sumcap / Circuit `queued` 一致）。
- 后续亏损/清算回流先 **偿还队列**，再增长 LP 余额。
- Circuit：`fundFrom: "queued"` 可用排队中的赢利继续开仓；该仓平仓后剩余保证金回 `queued`；清算则没收。

### 2.4 PAPER（loss mining）
- **仅**在亏损平仓或清算时铸造；**无** pre-mint / team / VC / airdrop（多源一致）。
- **不可转让**（Circuit：cannot be transferred）；可 **stake / unstake**（即时、无锁仓）；`claim()` 领 USDC rewards。
- 排放（SECONDARY，多源交叉）：tracked LP **<$2M**（含 underwater）→ **100 PAPER / $1** 合格亏损；之上衰减；`trackedLpUsd` 高水位棘轮。paperdao 给出衰减式 `100 · (S/(S+H))²`，`S=$120M` — **待官方 docs 二次确认** 后再钉死进合约 PRD。
- 质押收益：协议收入 / 超 **$5M** soft-cap 后超额流向 stakers（Bankless / PaperJet / paperdao）。

### 2.5 仓位与清算（Circuit + SECONDARY）
- 开仓：`asset` ∈ {`"BTC"`,`"ETH"`}；`side` long/short；`margin` USDC；`leverage`；notional = margin × leverage。
- Keeper 最小（Circuit 现写）：**min margin 10 USDC**、**min notional 10,000 USDC** → 最小仓即 10 USDC @ 1000×。
- 平仓：一次最多 12 个 `positionIds`；结果含 `exitPrice`、`pnl`（含 win haircut/fee）、`paperMinted`、是否已被清算。
- 清算阈值：SECONDARY 称约 **5 bps** 不利波动即 bust（1000× 下约 0.05%）；**以官方/合约为准**，PRD 勿写死未验证常数。

### 2.6 UX 表面（从机制反推 · 官网 fetch 极瘦）
官网 WebFetch 几乎只有 slogan。可合理推断 desk 需暴露（**UNVERIFIED UI 布局**，机制驱动）：
1. 开仓票：资产 / 方向 / 保证金 / 杠杆 → 预览 notional、liq price  
2. 账户：`balance` / `queued` / open positions / PAPER（unstaked·staked·claimable）  
3. 队列可视化：FIFO 位置与排队利润  
4. 亏损反馈：平仓即显示 `paperMinted`  
5. Stake / Claim 面板  

**红黑 UI：** 用户指定本场 remake 用 **red/black** 色系（见 PRD）；与原先「红涨绿跌」开放问题脱钩。

---


### 2.7 Session key 与集成门槛（Cooper + paperpad）
- **Session key：** 可签开/平仓 intents；**不能提现**（资金出金仍在主钱包/EVM 账户控制）。适合 agent：交易权限与提现权限分离。
- **Phase-one 接入：** 交易经前端 / **白名单 relayer**；intent schema、relayer endpoint、**合约地址 unpublished/TBA**。
- **无**已核实的官方公开 REST API / 官方 GitHub 源码仓（截至本核对）；外部集成（Circuit、paperpad）自建包装或等 relay。
- **Circuit** = 第三方 wrapper（自注册 30 天 session；与 papertrade.xyz 上 session **并列不计**）。
- **paperpad** = 另一第三方；明写 live Papertrade mechanics 等 **relay access**；现多用模拟器 + HL 价。

### 2.8 Martingaler 白纸（官方 PDF · 抽象层）
已抓 `martingaler-whitepaper.pdf`：提出 **无初始 LP**、**payout queue**、**Solvency Ratio Invariant (SRI)**、可选 token emissions，用于异步投机游戏。Papertrade 的 FIFO/loss-mint 是该思想在合成永续上的落地；**白纸本身不是链上参数表**，Solana remake 实现队列+SRI 精神即可，勿逐字当合约 ABI。

## 3) Circuit agent SDK（实有 · 可抄模式 · **第三方**）

**权威（第三方 wrapper，非 papertrade 官方）：** https://docs.circuit.org/agent-developers/sdk-reference/papertrade

**注意：** 因官方 intent/relayer 未公开，Circuit 能跑通 ≠ 存在公开官方 API。本场 **不依赖** Circuit 接 HL；只抄方法形状。  

| 方法 | 作用 |
| --- | --- |
| `agent.papertrade.positions.open({ asset, side, margin, leverage, fundFrom? })` | 开孤立合成仓 |
| `agent.papertrade.positions.close({ positionIds })` | 平 1–12 仓 |
| `agent.papertrade.positions.closed({ positionIds })` | 查已平（含他处 session 平仓） |
| `agent.papertrade.account.retrieve()` | balance / queued / positions / paper |
| `agent.papertrade.paper.stake({ amount })` | 质押 |
| `agent.papertrade.paper.unstake({ amount })` | 解押 |
| `agent.papertrade.paper.claim()` | 领 USDC 奖励 |

其它（Circuit）：
- 入金：HyperCore USDC ↔ Papertrade USDC（asset `0`，18 decimals；最少 10 USDC）。
- Session key：Circuit 自注册 30 天 session，与 papertrade.xyz 上的 key **并列不计**。
- 错误：`VENUE_PAUSED` 等（error-handling 文档）。
- **明确区分：** `circuit run --paper` = 模拟资金；**Papertrade venue ≠ paper mode**。

**对本场 remake 的抄法：** 不要绑 Circuit 跑 Hyperliquid；抄 **工具面形状**（open/close/account/paper stake·claim + queued fundFrom），在 **Solana program** 上实现同构副作用。

---

## 4) 与 WRONG-PRODUCT（旧稿）对照

| 旧（Alpaca 纸面） | 真（papertrade.xyz） |
| --- | --- |
| 模拟资金、无真实对手方 | **真实 USDC**；对手方 = 协议 LP |
| 回测 → paper → live 漏斗 | **合成永续 venue**；loss mining 是核心 |
| Fill = quote×滑点表 | Fill = **BBO mid**；赢利有 impact/fee |
| 无代币 | **PAPER** 由亏损铸造 |
| 无派彩排队 | **FIFO payout queue** |
| Alpaca MCP / CLI | **Circuit `agent.papertrade.*`** |

旧 RESEARCH 中 Conviction / Scalar Field / Alpaca / TradingView 章节 → **WRONG-PRODUCT 归档**（见文末）。可作「通用 agent desk UX」弱参考，**不得**再定义本产品。

---

## 5) Solana remake 可抄清单（机制层 · 给 PRD）

必须保留的 **行为差异**（评委能复述）：
1. 合成仓对 **自举 LP / Martingaler**（非 CLOB；**禁止 fork HL 合约**）  
2. 价格源 = **Solana 预言机**（Cooper：**Pyth / Switchboard** 等；开放问题钉死）  
3. 高杠杆孤立仓；固定 margin+leverage；无 partial close / top-up（默认同 Circuit 语义）  
4. 赢：利润可进 **FIFO payout queue**；亏：**loss-mint** 入 LP  
5. Stake loss-token → 协议收入分成（MVP 可简化）  
6. **Session-key agent**：可交易、**不可提现**  
7. 工具面可镜像 Circuit 形状，但是 **自建 Solana program + 自有权限模型**  

明确 **delta vs Hyperliquid 原版**（见 PRD §Deltas）。

---

## 6) 风险 / 未知（研究诚实）

- 官方 docs.papertrade.xyz **全文未成功抓取** → 排放曲线、impact 参数、2% fee 等以 SECONDARY 为主；Build 前需再抓或读链上配置。  
- Sumcap 写明 Papertrade **未公开** impact 校准，模拟借用 Rollbit → **禁止**把 Rollbit 数字写成「官方规格」。  
- 可持续性依赖持续亏损流（Sumcap 主题）— PRD 标 experimental，不装「已证明 PMF」。  
- 合规：真实 USDC 高杠杆衍生品；黑客松 demo 网络/资金档必须用户钉死。

---

## 7) WRONG-PRODUCT 归档（旧 Alpaca 框架）

以下主题曾写入本文件 ~23:45 HKT 版，现标 **WRONG-PRODUCT**，**不再驱动 PRD**：

- Conviction NL→backtest→paper→live  
- Scalar Field `ALPACA_PAPER` / `strategy.execute(target)` 作为产品核  
- Alpaca paper API / CLI / MCP 作为加速栈  
- 「纸面 fill 公式 × Jupiter quote 仿真」当作 papertrade.xyz 等价物  
- 「Onchain Paper Desk」若指 **模拟资金账本** 而非 **loss-mining synth perps**

保留文件历史意义：证明曾误读用户意图；以本版为准。

---

## 8) 源列表（短）

1. https://papertrade.xyz/  
2. https://docs.papertrade.xyz/  
3. https://docs.papertrade.xyz/martingaler-whitepaper.pdf  
4. https://docs.circuit.org/agent-developers/sdk-reference/papertrade  
5. https://docs.circuit.org/llms.txt  
6. https://www.bankless.com/read/papertrade-turns-liquidations-into-ownership  
7. https://cryptoway.io/guides/papertrade-exchange-explained/  
8. https://www.sumcap.xyz/blog/the-house-always-wins  
9. https://docs.paperjet.world/papertrade  
