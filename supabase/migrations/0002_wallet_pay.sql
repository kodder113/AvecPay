-- Paying from a connected wallet.
--
-- wallet_pay_contract: the official USDT contract the sender's wallet may send,
--   fixed when the transfer is created. NULL means copy-paste only (unknown
--   network, sandbox/testnet, or the provider reported a different contract).
-- sender_tx_hash: the sender's own transaction, recorded when they pay from a
--   connected wallet. Informational only; status still comes from the provider.

alter table public.transfers
  add column wallet_pay_contract text,
  add column sender_tx_hash text;
