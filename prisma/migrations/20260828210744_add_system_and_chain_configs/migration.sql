-- CreateTable
CREATE TABLE "SystemConfig" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "platformFeePercent" DECIMAL(5,2) NOT NULL DEFAULT 15.00,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChainConfig" (
    "id" TEXT NOT NULL,
    "chain" "SupportedChain" NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "minAmountNaira" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChainConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChainConfig_chain_key" ON "ChainConfig"("chain");
