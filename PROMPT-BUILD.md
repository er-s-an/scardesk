# Scardesk · 10-12 下午产品化狂迭代（Devnet 已通 · 不 Submit）

Context（已落地，勿重做）：
- Program Devnet `E7kH2K4YGgcRpQergDAwyHhD7giLvPKbN2SqZk8WXF4b`；public-proof ok（queue+SCAR）。
- 并行任务可能正在把 maxLeverage → 1001（勿回滚到 1000）。
- 本地 desk `http://127.0.0.1:8787`；RPC OnFinality 易 429，退避重试。
- 目标：冲奖金奖杯；Sol 更疯 remake papertrade；红黑自有风格；禁 HL fork / set_balance。
- **禁止 Colosseum Submit / 注册动作。**

## 本轮必须交付（可感、可点、可切网）

1. **config 切网**：`networks.json` + env（SCARDESK_RPC / SCARDESK_NETWORK）一键 localnet↔devnet；desk 启动读 deployment.devnet.json；写清 HOW-TO-RUN「别人克隆如何连 Devnet」。
2. **丝滑主环 UX**（对照 papertrade 操作流，非像素抄）：连接钱包 → 充值 dUSD → 开/平仓（含 1001× 若已上）→ 仓位/保证金拦截 toast → 亏铸 SCAR 可见 → 赢进 FIFO queue 可见 → session key 能交易不能提现的拒绝提示。连接态、断线、RPC 429、签名拒绝都要人话提示。
3. **浏览器实测**：更新 BROWSER-PROOF.md（截图或逐步结果）；真钱包路径优先，浏览器密钥路径保留。
4. **公网可给人用雏形**：尽量 Pages/静态+指向 Devnet 的 desk 部署说明或可访问预览；若不能真挂 Pages，至少产出部署脚本 + README 一段「公网打开三步」。
5. **FIDELITY 扫尾**：对照 FIDELITY A* / GAP-CHECKLIST，把还能当天补的 A 项补上；B* 标 provisional；更新 STATUS.md 诚实写还缺什么。

## 不做
- 不 Submit；不 Lane Submit；不主网。
- 不空转等钥匙；缺 HELIUS/PYTH key 就记缺口继续 UX。

## 完工判定
落盘：STATUS.md、GAP-CHECKLIST 更新、HOW-TO-RUN 切网段、BROWSER-PROOF 更新、desk 可点；写一句「本轮交付摘要」到 STATUS 顶部。

## OVERRIDE 2026-10-12 ~13:37（追加 · 勿忽略）
- 市场：**SOL + BTC + ETH**（FIDELITY A18 / PRD-LOCK 已改）
- 补技术指标/图表，对照 papertrade.xyz，红黑自有风格
- 可签环不停；不 Submit；非主网
- 若你还在跑：把多市切换+指标纳入本轮交付，勿只做单 SOL
