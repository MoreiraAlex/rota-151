-- CreateTable
CREATE TABLE "trainer" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "saveVersion" INTEGER NOT NULL,
    "heldItemId" TEXT,
    "inventory" JSONB NOT NULL,
    "pokedex" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trainer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pokemon" (
    "id" TEXT NOT NULL,
    "trainerId" TEXT NOT NULL,
    "speciesId" TEXT NOT NULL,
    "ballId" TEXT,
    "level" INTEGER NOT NULL,
    "xp" INTEGER NOT NULL,
    "ivs" JSONB NOT NULL,
    "moves" JSONB NOT NULL,
    "storedVitals" JSONB,
    "faintTimeLeft" DOUBLE PRECISION,
    "conditions" JSONB,
    "location" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pokemon_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "trainer_userId_key" ON "trainer"("userId");

-- CreateIndex
CREATE INDEX "pokemon_trainerId_idx" ON "pokemon"("trainerId");

-- AddForeignKey
ALTER TABLE "trainer" ADD CONSTRAINT "trainer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pokemon" ADD CONSTRAINT "pokemon_trainerId_fkey" FOREIGN KEY ("trainerId") REFERENCES "trainer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
