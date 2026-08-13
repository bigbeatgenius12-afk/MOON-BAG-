---
name: Moon Bag simulation design decisions
description: Deliberate design choices in the Moon Bag simulated trading app that should not be "fixed"
---

- Moon Bag is a **simulated** trading app: no auth/sessions by design; `trader_name` is a client-supplied local identity. Do not add real auth unless the user asks.
- Payment-coin swaps (buy X with BLUJO/MGOAT/SOL) are **frontend-orchestrated** (sell payCoin → buy target); the trade API only knows USD amounts. MGOAT-only restriction for new coins is enforced in UI, not server — accepted limitation.
- Sells ARE validated server-side (must hold the coin, can't oversell) — this was a real mint-money bug, keep the validation.
- **Why:** an architect review flagged auth/server-enforcement as failures; user scope is a fun simulation, so only the economic-correctness bug was fixed.

## Launch fee & MGOAT economy
- Launching a coin costs 10,000,000 MGOAT, charged client-side (both web and mobile) by selling MGOAT via the trade endpoint WITHOUT crediting proceeds to the local wallet.
- **Why:** user chose MGOAT-denominated monetization; app is no-auth, so all charges are client-orchestrated like swaps.
- **How to apply:** the trade endpoint takes a 10% fee, so any token-exact charge must gross up USD by /0.9. GET /launched-coins?ticker=X is the guaranteed coin lookup — never scan the newest-N list for a required coin.
- MGOAT has elastic supply (228T start): server mints +10% when >90% of supply is held after a buy — MGOAT can never run out; market cap grows with supply.

## MGOAT is the buy currency
All coins are bought with MGOAT (input denominated in MGOAT tokens), except MGOAT itself which is bought with USD/SOL. Client-orchestrated: sell MGOAT → buy coin with proceeds (two trades, two 10% fees — accepted by design). Look up MGOAT/BLUJO via the ticker query param, never a bounded coin list; derive page identity from the coin detail response ticker.
