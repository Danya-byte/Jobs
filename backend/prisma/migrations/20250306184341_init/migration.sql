-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "username" TEXT,
    "nick" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "profileLink" TEXT NOT NULL,
    "experience" INTEGER,
    "description" TEXT NOT NULL,
    "requirements" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "categories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "contact" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vacancy" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "companyUserId" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "requirements" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "categories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "contact" TEXT NOT NULL,
    "officialWebsite" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "photoUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vacancy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "date" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FreelancerSubscription" (
    "userId" TEXT NOT NULL,
    "positions" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "FreelancerSubscription_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "CompanySubscription" (
    "userId" TEXT NOT NULL,
    "companies" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "CompanySubscription_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "Favorite" (
    "userId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Favorite_pkey" PRIMARY KEY ("userId","itemId")
);
