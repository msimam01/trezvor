export enum BotCallbackAction {
  ACTION_BUY_GAS = 'ACTION_BUY_GAS',
  ACTION_MY_ORDERS = 'ACTION_MY_ORDERS',
  ACTION_HELP = 'ACTION_HELP',
  ACTION_BACK = 'ACTION_BACK',
  ACTION_HOME = 'ACTION_HOME',
  ACTION_PAY_NOW = 'ACTION_PAY_NOW',
}

export enum BotCallbackChain {
  CHAIN_SOLANA = 'CHAIN_SOLANA',
  CHAIN_BASE = 'CHAIN_BASE',
  CHAIN_TON = 'CHAIN_TON',
}

export enum BotCallbackAmount {
  AMT_1000 = 'AMT_1000',
  AMT_2500 = 'AMT_2500',
  AMT_5000 = 'AMT_5000',
  AMT_CUSTOM = 'AMT_CUSTOM',
}

export enum BotSessionStep {
  IDLE = 'IDLE',
  SELECT_CHAIN = 'SELECT_CHAIN',
  SELECT_AMOUNT = 'SELECT_AMOUNT',
  AWAITING_CUSTOM_AMOUNT = 'AWAITING_CUSTOM_AMOUNT',
  AWAITING_WALLET = 'AWAITING_WALLET',
}

export const AMOUNT_NAIRA_MAP: Partial<Record<BotCallbackAmount, number>> = {
  [BotCallbackAmount.AMT_1000]: 1000,
  [BotCallbackAmount.AMT_2500]: 2500,
  [BotCallbackAmount.AMT_5000]: 5000,
};

export const CHAIN_DISPLAY_NAMES: Record<BotCallbackChain, string> = {
  [BotCallbackChain.CHAIN_SOLANA]: 'Solana (SOL)',
  [BotCallbackChain.CHAIN_BASE]: 'Base (ETH)',
  [BotCallbackChain.CHAIN_TON]: 'TON (TON)',
};