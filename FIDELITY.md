# FIDELITY — Scardesk vs papertrade.xyz

核对：2026-10-12 ~00:35 HKT（用户群澄清 · 经小可）。  
产品：**Scardesk** · loss-token **SCAR** · repo `scardesk`。  
赛场：Colosseum · Surfnet/devnet · **demo stable**（非主网真 USDC）。

## 用户口径（权威）

1. **功能环全复刻** papertrade.xyz（不是薄 MVP / 演示壳）。  
2. **用 Solana 做更疯的版本**（杠杆叙事、链上可见、结算强制）——**禁止 fork HL/HyperEVM**。  
3. **UI/UX 布局与操作流全复刻**，再套 **红黑自有风格**——**禁止像素抄原站**。

本清单进 PRD 附件；Build 以本页 + `PRD-LOCK.md` 为准。冲突时：**用户口径 > 本清单 > 旧 PRD §7「薄 MVP」措辞**（§7 已废止缩水边界）。

---

## A. 必须对齐（行为 / 环路 / UX 流）

| # | 项 | 对齐标准 | 备注 |
| --- | --- | --- | --- |
| A1 | 合成永续 vs 协议 LP | 无 orderbook；开/平对自举 LP 结算 | 非 HL CLOB、非 Jupiter 现货 |
| A2 | 孤立仓 | margin × leverage = notional；无 partial close / margin top-up（对齐 Circuit） | |
| A3 | 杠杆叙事 | 默认上限 **1000×**（可配置下调演示） | 「更疯」= 保留极高杠杆叙事 |
| A4 | 亏损 / 清算 → LP | 已实现亏损与清算进 LP | |
| A5 | Loss mining | 仅亏损/清算铸 **SCAR**；不可转让；可 stake / unstake / claim | 不可 `mint_free` / 改余额 |
| A6 | FIFO 派彩 | LP 不足付赢家：退 margin，利润入队；后续流入先还 queue head | `queued` 可见 |
| A7 | `fundFrom: queued` | 可用排队利润再开仓（平后剩余回 queued；清算没收） | Circuit 同构 |
| A8 | Session key | 可 open/close；**不可 withdraw**；亦不可 stake/claim（Q15=A） | trade key ≠ vault authority，链上可见 |
| A9 | Agent 工具面 | `positions.open/close/closed` · `account.retrieve` · `paper.stake/unstake/claim` 语义同构 | 自研 loop；不绑未公开 relayer |
| A10 | 人手 Order Ticket | 与 agent **同一结算路径** | Q10=A |
| A11 | Solana 可读状态 | explorer 可指：balance、position PDA、LP vault、queue head/tail、SCAR mint/余额/stake | 关掉 program = 环不成立 |
| A12 | UX 信息架构 | Account（balance·queued）｜ Open ticket｜ Positions｜ Queue｜ SCAR stake/claim｜ Agent activity log | **流全复刻** |
| A13 | UX 反馈 | 亏损平仓强反馈「SCAR minted」；队列可视化排队利润/队首距离 | |
| A14 | 文案禁区 | Synthetic perps · Loss-funded LP · FIFO — **禁止** “paper trading simulator” / Alpaca 叙事 | 禁冒充 papertrade/PAPER |
| A15 | 色系语义 | 红黑自有风格；**红=涨**；跌用灰/暗色 | **非像素抄**原站 |
| A16 | Demo 脚本 | 亏损铸币 **与** 赢利进队再靠亏损出队 **都演**（≤3min） | Q14=C |
| A17 | 网络 / 资金 | Surfnet 优先（可落公共 devnet）；**demo stable、同结算规则** | 非主网真 USDC |
| A18 | 标的 | **SOL/USD only** | Q1 |
| A19 | 价格源角色 | 开/平仓价 = 文档化 mid（**Pyth 主 + fixture 备用**） | 角色对齐「预言机 mid」，非 HL BBO 本身 |

---

## B. 允许简化（须在 README 标 *provisional* / delta）

| # | 项 | 可简化成 | 不可删成 |
| --- | --- | --- | --- |
| B1 | 价格源实现 | Pyth mid + fixture；≠ HL BBO mid | 不可改成「假随机价」或 Jupiter 现货路由当主 mid |
| B2 | 排放曲线 | 简化表（如固定 N SCAR / $1 合格亏损） | 不可无 mint / 随意空投 SCAR |
| B3 | Win haircut / impact | 公开简化常数表 | 不可无 fee 规则导致 LP 永不增长 |
| B4 | 清算阈值常数 | 文档化简化阈值（对齐「高杠杆易 bust」叙事） | 不可无法清算 |
| B5 | Soft-cap / staker 分流 | MVP：fee 累计可 claim 最小环 | 不可 stake 无 claim 出口（除非标 stub 且 Demo 不依赖） |
| B6 | Keeper / min notional | 可放宽 min margin/notional 便于 faucet 演示 | 不可取消孤立仓模型 |
| B7 | Relayer / 官方 intent | **自建** session + 程序；不接未公开 papertrade relayer | 不可声称官方对接 |
| B8 | 多市场 | 仅 SOL/USD | 不可扩成任意币本场 |
| B9 | UI 视觉 | 布局/操作流对齐；红黑自绘组件 | **禁止**像素级抄原站资产 |
| B10 | 主网真 USDC | 本场不做 | 真钱主网另开一轮 |

---

## C. Solana「更疯」加码（相对原版叙事，仍须机制同构）

| # | 加码 | 说明 |
| --- | --- | --- |
| C1 | 链上强制结算 | 仓位/LP/队列/铸币全在 Solana program；评委可 explorer 验 |
| C2 | 1000× 叙事保留 | 默认上限对齐原版极致杠杆；演示可下调 |
| C3 | Session 分离可见 | trade≠withdraw 写进账户模型，比「前端约定」更可指 |
| C4 | 禁止假 P&L 工具 | 无 set_balance / set_pnl / mint_free |

**不做的「更疯」：** fork HL；主网赌真 USDC；未核清治理参数逐字抄进合约却标 official。

---

## D. 明确禁止

- Fork / 移植 Hyperliquid 或 HyperEVM 合约  
- 冒充 papertrade.xyz / PAPER；makebook  
- 薄壳：只 UI 无结算、或 agent 直接改余额  
- 像素抄原站  
- 本场 Submit 真主网 USDC 资金档  
- Lane 切代码 / Lane Submit（除非用户另令）

---

## E. Build 验收（相对旧「薄 MVP」抬标）

1. A1–A19 行为可演示；B 项凡简化须 README 一行 *provisional* + delta 表。  
2. Explorer 至少一次 **SCAR mint** 与一次 **queue 写入**。  
3. Agent `open`→`close` 全程无直接改余额工具。  
4. UI：信息架构与操作流对齐 A12–A15；红黑自有，非像素抄。  
5. 文案无 Alpaca-paper / 模拟器误导。

指针：`PRD.md` · `PRD-LOCK.md` · `OPEN-QUESTIONS.md` · `RESEARCH.md`

---

## F. 产品化抬标（2026-10-12 ~02:55 HKT · 用户群）

用户口径：**按产品化迭代**；功能/操作对齐 papertrade 抄全；**改个 net（RPC/cluster）就能发给别人用**；先不 Submit。

| # | 必须 | 说明 |
| --- | --- | --- |
| F1 | Config-driven 网络 | `mainnet-beta` / `devnet` / `localnet`（及自定义 RPC）一行配置可切；禁止硬编码本机 8899 |
| F2 | 可交付包 | README：如何切网、连 Phantom/Solflare、跑 demo stable、浏览器点通路径 |
| F3 | 浏览器实测算 | 连钱包 → 开平仓 → queue/SCAR 全路径在目标网上可复现 |
| F4 | 仍禁 | fork HL；像素抄原站；主网真 USDC（本场默认仍 demo stable，切主网若做须另明示风险） |
| F5 | 提交窗口 | **10-12 狂迭代 → 10-13 收敛 → DDL 前必交**（用户已选不放弃 Colo）；Submit 仍需点头 |
