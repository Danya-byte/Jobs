-- CreateIndex
CREATE INDEX "CompanySubscription_companies_idx" ON "CompanySubscription"("companies");

-- CreateIndex
CREATE INDEX "Favorite_userId_itemId_idx" ON "Favorite"("userId", "itemId");

-- CreateIndex
CREATE INDEX "Favorite_userId_idx" ON "Favorite"("userId");

-- CreateIndex
CREATE INDEX "FreelancerSubscription_positions_idx" ON "FreelancerSubscription"("positions");

-- CreateIndex
CREATE INDEX "Job_userId_idx" ON "Job"("userId");

-- CreateIndex
CREATE INDEX "Job_position_idx" ON "Job"("position");

-- CreateIndex
CREATE INDEX "Job_createdAt_idx" ON "Job"("createdAt" DESC);

-- CreateIndex
CREATE INDEX "Review_targetUserId_date_idx" ON "Review"("targetUserId", "date" DESC);

-- CreateIndex
CREATE INDEX "Review_authorUserId_idx" ON "Review"("authorUserId");

-- CreateIndex
CREATE INDEX "Review_createdAt_idx" ON "Review"("createdAt");

-- CreateIndex
CREATE INDEX "Vacancy_companyUserId_idx" ON "Vacancy"("companyUserId");

-- CreateIndex
CREATE INDEX "Vacancy_companyName_idx" ON "Vacancy"("companyName");

-- CreateIndex
CREATE INDEX "Vacancy_position_idx" ON "Vacancy"("position");

-- CreateIndex
CREATE INDEX "Vacancy_createdAt_idx" ON "Vacancy"("createdAt" DESC);
