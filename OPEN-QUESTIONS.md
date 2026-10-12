# OPEN-QUESTIONS — 需用户决策（小可转问）

核对：2026-10-11 ~23:55 HKT（Cooper brief）。  
阶段：产品已纠正为 **papertrade.xyz 机制 → Solana remake** → **PRD 已点头（经小可 · 用户全收 P0）** → **Build 已交比赛可**。  
Lane：双视频继续；不 Submit；不切 Paychannel 代码。

决议列写入时间：2026-10-11 ~23:55 HKT。歧义项若小可回传不同答法，以小可更正为准。

> **纠正（2026-10-11 ~23:51 HKT）：** 决议列以用户 widget 原文为准；Q3=**demo stable**（非真 USDC）；Q2=**Pyth+fixture**（非 Jupiter 为主）。


---

## P0 — 挡住 PRD 点头 / Build

| # | 问题 | 选项 / 说明 | 决议 |
| --- | --- | --- | --- |
| **Q1** | **MVP 交易标的钉死哪些？** | 原版 BTC/ETH。Solana remake 建议：**A) SOL/USD 仅 1 个** · **B) SOL + BTC（若用 Pyth/合成价）** · **C) 你指定 1–2 个**。禁止「任意币」 | **A) SOL/USD only**（用户 widget 原文 · 经小可） |
| **Q2** | **价格源？** | Cooper 倾向预言机：**A) Pyth** · **B) Switchboard** · **C) Pyth 主 + fixture 备用** · **D) 其它（写明）**。Jupiter 现货路由价作 mid **非默认**（与原 HL BBO 预言机角色不同） | **C) Pyth 主 + fixture 备用**（用户 widget 原文 · 经小可） |
| **Q3** | **资金档？** | **A) 真 Solana USDC（devnet/surfnet faucet 或微额）** · **B) 协议自有 demo stable（仍走同一结算规则，文案写明）** · **C) 你指定**。须避免评委理解成「假数字模拟器」 | **B) demo stable、同结算规则**（用户 widget 原文 · 经小可纠正；文案写明非假 P&L 模拟器） |
| **Q4** | **英文产品名 / loss-token 名？** | 禁冒充 papertrade / PAPER。需全新品牌 + GitHub 名。请你起名或授权拟 3 个候选 | **锁定 Scardesk / SCAR / `scardesk`**（用户授权取名 · 经小可 2026-10-11 ~23:57 HKT） |
| **Q5** | **与 Lane / Paychannel 的赛场关系？** | **A) 双轨并行，截止前你再选一条 Submit** · **B) 本 PRD 点头后本方向主推，Lane 只保视频不 Submit** · **C) 其它** | **B) 本方向主推；Lane 只保视频不 Submit**（用户 widget 原文 · 经小可；Build 已交比赛可） |
| **Q6** | **红黑 UI 的涨跌语义？** | 色系已钉 **红/黑**。另需：**A) 红=涨、另一色=跌** · **B) 红仅品牌/危险高亮，涨跌用红vs灰** · **C) 你指定** | **A) 红=涨；跌用灰/暗色（黑底）**（用户 widget 原文 · 经小可） |

---

## P1 — 强烈影响 MVP 边界

| # | 问题 | 选项 / 说明 | 决议 |
| --- | --- | --- | --- |
| **Q7** | **杠杆上限？** | 原版至 1000×。MVP：**A) 1000×（对齐叙事）** · **B) 较低上限（如 50–100×）降演示事故** · **C) 可配置，默认 ___** | **A) 1000× 对齐叙事**（Build 默认；可配置下调） |
| **Q8** | **排放曲线保真度？** | 官方全文未抓全。**A) 简化表（如固定 N token/$1 亏损 + README 声明 provisional）** · **B) 尽量复刻 $2M flat→decay（需再核 docs）** · **C) 等官方参数再 Build** | **A) 简化 provisional 表** |
| **Q9** | **网络？** | **A) Surfnet 优先（对齐 Lane）** · **B) 公共 devnet** · **C) 你指定** | **A) Surfnet 优先** |
| **Q10** | **人手 Order Ticket？** | **A) 要（desk 完整）** · **B) 不要，仅 agent 工具** | **A) 要** |
| **Q11** | **Agent 运行时？** | **A) 自研最小 tool loop（推荐黑客松）** · **B) 尽力兼容 Circuit 风格客户端（不接 HL）** · **C) 其它** | **A) 自研最小 tool loop**（工具面形状对齐 Circuit） |
| **Q15** | **Session key 权限边界？** | 硬核：可交易、不可提现。额外：**A) 亦不可 stake/claim（对齐 paperpad 表）** · **B) 允许 stake/claim（对齐 Circuit 暴露面）** · **C) 你指定** | **A) 可交易不可提现；亦不可 stake/claim** |

---

## P2 — 体验 / 合规语气

| # | 问题 | 选项 / 说明 | 决议 |
| --- | --- | --- | --- |
| **Q12** | **UI 文案语言？** | **A) 中英双语** · **B) 英文评委版为主 + 中文说明** · **C) 仅中文（评委风险）** | **B) 英文评委版为主 + 中文说明** |
| **Q13** | **风险披露强度？** | 页脚一行 · 或开屏强制「高杠杆 / 队列兑付风险 / 非投顾 / 非官方 papertrade」 | **开屏强制一行 + 页脚常驻** |
| **Q14** | **Demo 脚本偏好？** | **A) 先演亏损铸币** · **B) 先演赢利进队再靠第二笔亏损出队** · **C) 两条都演** | **C) 两条都演**（≤3min 内压缩） |

---

## 小可开场提问稿（可直接发）

> 产品已纠正：我们要做的是 **papertrade.xyz 那种合成永续 + 亏损铸币 + FIFO 队列**，搬到 **Solana**，不是 Alpaca 纸面交易。  
> 1) MVP 只做哪些标的？（建议只要 SOL）  
> 2) 价格用 **Pyth** 还是 **Switchboard**（或其它预言机）？  
> 3) 用真 USDC 演示，还是协议 demo stable（规则仍真）？  
> 4) 产品英文名 / loss-token 叫什么？（不能叫 PAPER）  
> 5) 和 Lane：双轨到最后再选 Submit，还是本 PRD 点头后主推这个？  
> 6) 红黑色系下，涨跌怎么用红？

---

## 已钉死（无需再问）

| 项 | 值 |
| --- | --- |
| 参考产品 | **https://papertrade.xyz**（非 Alpaca paper） |
| 机制核 | 合成永续 · 自举 LP · FIFO 派彩 · loss-token |
| UI 色系 | **红 / 黑** |
| Makebook | **禁止** |
| Build 时机 | **已点头；Build 已交比赛可（2026-10-11）** |
| Lane 双视频 | **不停**；**不 Submit**；**不切** Paychannel 代码 |
| 商业验证 | experimental；零访谈不装 PMF |
| Circuit / paperpad | 只抄 **工具面/session 模式**；均为第三方；**不绑**未公开 relayer |
| 合约策略 | **禁止 fork HL/HyperEVM**；Solana 自建 Martingaler+loss-mint+FIFO+session-key |
| 官方 API | docs 公开；**合约地址 TBA**；intent/relayer **未公开** |


---

## 决议（2026-10-11 用户点头 · 经小可）

| # | 决议 |
| --- | --- |
| Q1 | **A) SOL/USD only** |
| Q2 | **C) Pyth 主 + fixture 备用** |
| Q3 | **B) demo stable**（同结算规则，文案写明） |
| Q4 | **Scardesk / SCAR / scardesk**（用户授权取名） |
| Q5 | **B) 本方向主推**；Lane 双视频保留、不 Submit |
| Q6 | **A) 红=涨** |
| Build | **已点头 → 开 Build** |

P1 Build 默认（2026-10-12 抬标）：Q7 **1000× 对齐叙事**（可配置下调）、Q8 简化排放表 provisional、Q9 Surfnet 优先、Q10 要人手 ticket、Q11 自研最小 tool loop、Q15 可交易不可提现亦不可 stake/claim。保真见 `FIDELITY.md`。
