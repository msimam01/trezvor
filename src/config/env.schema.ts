import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().min(1),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  TELEGRAM_BOT_USERNAME: z.string().optional().default(''),
  APP_BASE_URL: z.string().optional().default('http://localhost:3000'),
  PAYSTACK_SECRET_KEY: z.string().min(1),
  ENABLE_BOT: z.string().optional().default('true'),
  // Web3 Configuration - Module 6 (optional in development)
  SOLANA_RPC_URL: z.string().optional(),
  SOLANA_VAULT_PRIVATE_KEY: z.string().optional(),
  BASE_RPC_URL: z.string().optional(),
  BASE_VAULT_PRIVATE_KEY: z.string().optional(),
  TON_RPC_URL: z.string().optional(),
  TON_API_KEY: z.string().optional(),
  TON_VAULT_MNEMONIC: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function validate(config: Record<string, unknown>) {
  try {
    const result = envSchema.parse(config);
    return result;
  } catch (error) {
    if (error instanceof z.ZodError) {
      const formattedErrors = error.issues.map(
        (err) => `${err.path.join('.')}: ${err.message}`
      );
      throw new Error(
        `Environment validation failed:\n${formattedErrors.join('\n')}`
      );
    }
    throw error;
  }
}