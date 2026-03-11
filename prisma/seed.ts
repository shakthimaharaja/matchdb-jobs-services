/**
 * prisma/seed.ts — Seeds mock data for the MatchDB marketer portal.
 *
 * Run: npx ts-node prisma/seed.ts
 * (Alternatively, add "prisma": { "seed": "ts-node prisma/seed.ts" } to package.json)
 *
 * Creates:
 *   - 2 marketer users (shell-services User table) — via raw SQL
 *   - 2 companies with unique IDs
 *   - 8 candidates (4 per company) with profiles
 *   - 12 job postings mapped to sourceUserId / sourceCompanyId
 *   - 6 forwarded openings
 *   - Mock invite records
 */

import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
import path from "path";

const ENV = process.env.NODE_ENV || "local";
dotenv.config({ path: path.resolve(__dirname, "../env", `.env.${ENV}`) });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const prisma = new PrismaClient();

// ─── Deterministic UUIDs for reproducibility ──────────────────────────────────

const MARKETER_1_ID = "a0000000-0000-0000-0000-000000000001";
const MARKETER_2_ID = "a0000000-0000-0000-0000-000000000002";
const COMPANY_1_ID = "c0000000-0000-0000-0000-000000000001";
const COMPANY_2_ID = "c0000000-0000-0000-0000-000000000002";

// 4 vendor user IDs (for job postings)
const VENDOR_1_ID = "v0000000-0000-0000-0000-000000000001";
const VENDOR_2_ID = "v0000000-0000-0000-0000-000000000002";

// 8 candidate user IDs
const CAND_IDS = Array.from(
  { length: 8 },
  (_, i) => `d0000000-0000-0000-0000-00000000000${i + 1}`,
);

// ─── Helper ───────────────────────────────────────────────────────────────────

function ago(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const SKILLS_POOL = [
  "React",
  "Node.js",
  "TypeScript",
  "Python",
  "Java",
  "AWS",
  "Docker",
  "Kubernetes",
  "PostgreSQL",
  "MongoDB",
  "GraphQL",
  "REST",
  "CI/CD",
  "Terraform",
  "Go",
  "Rust",
  "Angular",
  "Vue.js",
  "Redis",
  "Kafka",
];

const LOCATIONS = [
  "New York, NY",
  "San Francisco, CA",
  "Austin, TX",
  "Chicago, IL",
  "Seattle, WA",
  "Remote",
  "Denver, CO",
  "Boston, MA",
  "Los Angeles, CA",
  "Atlanta, GA",
];

const JOB_TITLES = [
  "Senior React Developer",
  "Full Stack Engineer",
  "Backend Engineer (Node.js)",
  "DevOps Engineer",
  "Cloud Architect",
  "Data Engineer",
  "Frontend Developer",
  "Platform Engineer",
  "SRE — Site Reliability Engineer",
  "Software Engineer II",
  "Lead TypeScript Developer",
  "API Engineer",
];

async function main() {
  console.log("🌱 Seeding mock data...\n");

  // ── 1. Users (via raw SQL since shell-services owns the table) ────────────

  const userUpsert = `
    INSERT INTO users (id, email, password, "firstName", "lastName", "userType", username, "isActive", "hasPurchasedVisibility", "createdAt", "updatedAt")
    VALUES ($1, $2, '$2a$12$dummyhashforseed000000000000000000000000000000000000', $3, $4, $5, $6, true, false, NOW(), NOW())
    ON CONFLICT (id) DO NOTHING;
  `;
  const subUpsert = `
    INSERT INTO subscriptions (id, "userId", plan, status, "createdAt", "updatedAt")
    VALUES (gen_random_uuid(), $1, $2, 'active', NOW(), NOW())
    ON CONFLICT ("userId") DO NOTHING;
  `;

  // Marketer 1 — TechStaff Solutions
  await prisma.$executeRawUnsafe(
    userUpsert,
    MARKETER_1_ID,
    "sarah@techstaff.io",
    "Sarah",
    "Mitchell",
    "marketer",
    "sarah-mitchell-a00001",
  );
  await prisma.$executeRawUnsafe(subUpsert, MARKETER_1_ID, "marketer");

  // Marketer 2 — PrimeHire Group
  await prisma.$executeRawUnsafe(
    userUpsert,
    MARKETER_2_ID,
    "james@primehire.com",
    "James",
    "Chen",
    "marketer",
    "james-chen-a00002",
  );
  await prisma.$executeRawUnsafe(subUpsert, MARKETER_2_ID, "marketer");

  // Vendor 1
  await prisma.$executeRawUnsafe(
    userUpsert,
    VENDOR_1_ID,
    "hr@acmetech.com",
    "David",
    "Roberts",
    "vendor",
    "david-roberts-v00001",
  );
  await prisma.$executeRawUnsafe(subUpsert, VENDOR_1_ID, "pro");

  // Vendor 2
  await prisma.$executeRawUnsafe(
    userUpsert,
    VENDOR_2_ID,
    "recruit@globalsoft.io",
    "Emily",
    "Park",
    "vendor",
    "emily-park-v00002",
  );
  await prisma.$executeRawUnsafe(subUpsert, VENDOR_2_ID, "pro");

  // Candidate users
  const candidateNames = [
    ["Alex", "Johnson", "alex@techstaff.io"],
    ["Maria", "Garcia", "maria@techstaff.io"],
    ["Ryan", "Patel", "ryan.patel@techstaff.io"],
    ["Lisa", "Kim", "lisa.kim@techstaff.io"],
    ["Daniel", "Brown", "daniel@primehire.com"],
    ["Sophia", "Lee", "sophia@primehire.com"],
    ["Marcus", "Wilson", "marcus.w@primehire.com"],
    ["Priya", "Sharma", "priya.sharma@primehire.com"],
  ];

  for (let i = 0; i < 8; i++) {
    const [fn, ln, email] = candidateNames[i];
    await prisma.$executeRawUnsafe(
      userUpsert,
      CAND_IDS[i],
      email,
      fn,
      ln,
      "candidate",
      `${fn!.toLowerCase()}-${ln!.toLowerCase()}-d0000${i + 1}`,
    );
    await prisma.$executeRawUnsafe(subUpsert, CAND_IDS[i], "free");
  }

  console.log("  ✅ 12 users created (2 marketers, 2 vendors, 8 candidates)");

  // ── 2. Companies ──────────────────────────────────────────────────────────

  await prisma.company.upsert({
    where: { id: COMPANY_1_ID },
    create: {
      id: COMPANY_1_ID,
      name: "TechStaff Solutions",
      marketerId: MARKETER_1_ID,
      marketerEmail: "sarah@techstaff.io",
    },
    update: {},
  });

  await prisma.company.upsert({
    where: { id: COMPANY_2_ID },
    create: {
      id: COMPANY_2_ID,
      name: "PrimeHire Group",
      marketerId: MARKETER_2_ID,
      marketerEmail: "james@primehire.com",
    },
    update: {},
  });

  console.log(
    "  ✅ 2 companies created (TechStaff Solutions, PrimeHire Group)",
  );

  // ── 3. Marketer Candidates (roster) ───────────────────────────────────────

  const rosterEntries = [
    // TechStaff roster (Marketer 1)
    {
      companyId: COMPANY_1_ID,
      marketerId: MARKETER_1_ID,
      candidateId: CAND_IDS[0],
      candidateName: "Alex Johnson",
      candidateEmail: "alex@techstaff.io",
      inviteStatus: "accepted",
    },
    {
      companyId: COMPANY_1_ID,
      marketerId: MARKETER_1_ID,
      candidateId: CAND_IDS[1],
      candidateName: "Maria Garcia",
      candidateEmail: "maria@techstaff.io",
      inviteStatus: "accepted",
    },
    {
      companyId: COMPANY_1_ID,
      marketerId: MARKETER_1_ID,
      candidateId: CAND_IDS[2],
      candidateName: "Ryan Patel",
      candidateEmail: "ryan.patel@techstaff.io",
      inviteStatus: "invited",
    },
    {
      companyId: COMPANY_1_ID,
      marketerId: MARKETER_1_ID,
      candidateId: CAND_IDS[3],
      candidateName: "Lisa Kim",
      candidateEmail: "lisa.kim@techstaff.io",
      inviteStatus: "none",
    },
    // PrimeHire roster (Marketer 2)
    {
      companyId: COMPANY_2_ID,
      marketerId: MARKETER_2_ID,
      candidateId: CAND_IDS[4],
      candidateName: "Daniel Brown",
      candidateEmail: "daniel@primehire.com",
      inviteStatus: "accepted",
    },
    {
      companyId: COMPANY_2_ID,
      marketerId: MARKETER_2_ID,
      candidateId: CAND_IDS[5],
      candidateName: "Sophia Lee",
      candidateEmail: "sophia@primehire.com",
      inviteStatus: "accepted",
    },
    {
      companyId: COMPANY_2_ID,
      marketerId: MARKETER_2_ID,
      candidateId: CAND_IDS[6],
      candidateName: "Marcus Wilson",
      candidateEmail: "marcus.w@primehire.com",
      inviteStatus: "invited",
    },
    {
      companyId: COMPANY_2_ID,
      marketerId: MARKETER_2_ID,
      candidateId: CAND_IDS[7],
      candidateName: "Priya Sharma",
      candidateEmail: "priya.sharma@primehire.com",
      inviteStatus: "none",
    },
  ];

  for (const entry of rosterEntries) {
    await prisma.marketerCandidate.upsert({
      where: {
        companyId_candidateEmail: {
          companyId: entry.companyId,
          candidateEmail: entry.candidateEmail,
        },
      },
      create: entry,
      update: {},
    });
  }

  console.log("  ✅ 8 marketer candidates (4 per company)");

  // ── 4. Candidate Profiles ────────────────────────────────────────────────

  const profiles = [
    {
      candidateId: CAND_IDS[0],
      name: "Alex Johnson",
      email: "alex@techstaff.io",
      phone: "(555) 101-0001",
      currentCompany: "TechStaff Solutions",
      companyId: COMPANY_1_ID,
      companyName: "TechStaff Solutions",
      currentRole: "Senior React Developer",
      preferredJobType: "contract",
      skills: ["React", "TypeScript", "Node.js", "GraphQL", "AWS"],
      experienceYears: 7,
      expectedHourlyRate: 85,
      location: "New York, NY",
      bio: "Experienced frontend architect specializing in React applications and micro-frontend architecture.",
      resumeSummary:
        "7+ years building enterprise React applications with TypeScript.",
      resumeExperience:
        "Senior Developer at CloudPeak Inc. (2020-2024)\nLead React Dev at DataStream Corp (2017-2020)",
      resumeEducation: "B.S. Computer Science, NYU (2017)",
      resumeAchievements:
        "Led migration from class components to hooks, reducing bundle size by 35%.",
    },
    {
      candidateId: CAND_IDS[1],
      name: "Maria Garcia",
      email: "maria@techstaff.io",
      phone: "(555) 101-0002",
      currentCompany: "TechStaff Solutions",
      companyId: COMPANY_1_ID,
      companyName: "TechStaff Solutions",
      currentRole: "Full Stack Engineer",
      preferredJobType: "full_time",
      skills: [
        "Node.js",
        "Python",
        "PostgreSQL",
        "Docker",
        "Kubernetes",
        "React",
      ],
      experienceYears: 5,
      expectedHourlyRate: 75,
      location: "San Francisco, CA",
      bio: "Full-stack developer with strong backend focus and DevOps experience.",
      resumeSummary:
        "5 years full-stack experience with Node.js and Python microservices.",
      resumeExperience:
        "Software Engineer at Nexus Labs (2021-2024)\nBackend Developer at StartEng (2019-2021)",
      resumeEducation: "M.S. Software Engineering, Stanford (2019)",
      resumeAchievements:
        "Designed event-driven architecture handling 50K+ events/sec.",
    },
    {
      candidateId: CAND_IDS[2],
      name: "Ryan Patel",
      email: "ryan.patel@techstaff.io",
      phone: "(555) 101-0003",
      currentCompany: "TechStaff Solutions",
      companyId: COMPANY_1_ID,
      companyName: "TechStaff Solutions",
      currentRole: "DevOps Engineer",
      preferredJobType: "contract",
      skills: ["AWS", "Terraform", "Docker", "Kubernetes", "CI/CD", "Python"],
      experienceYears: 6,
      expectedHourlyRate: 90,
      location: "Austin, TX",
      bio: "Cloud infrastructure specialist with AWS and Kubernetes expertise.",
      resumeSummary:
        "6 years building and managing cloud-native infrastructure on AWS.",
      resumeExperience:
        "Sr. DevOps at ScaleTech (2020-2024)\nCloud Engineer at InfraMax (2018-2020)",
      resumeEducation: "B.S. Computer Engineering, UT Austin (2018)",
      resumeAchievements:
        "Reduced deployment time from 45 min to 3 min through IaC pipeline automation.",
    },
    {
      candidateId: CAND_IDS[3],
      name: "Lisa Kim",
      email: "lisa.kim@techstaff.io",
      phone: "(555) 101-0004",
      currentCompany: "TechStaff Solutions",
      companyId: COMPANY_1_ID,
      companyName: "TechStaff Solutions",
      currentRole: "Data Engineer",
      preferredJobType: "contract",
      skills: ["Python", "Kafka", "PostgreSQL", "Redis", "AWS", "Go"],
      experienceYears: 4,
      expectedHourlyRate: 70,
      location: "Seattle, WA",
      bio: "Data pipeline specialist with experience in real-time streaming systems.",
      resumeSummary: "4 years designing data pipelines with Kafka and Python.",
      resumeExperience:
        "Data Engineer at StreamFlow (2022-2024)\nJr. Data Engineer at DataBridge (2020-2022)",
      resumeEducation: "B.S. Data Science, UW Seattle (2020)",
      resumeAchievements:
        "Built real-time analytics pipeline processing 1M+ events/hour.",
    },
    {
      candidateId: CAND_IDS[4],
      name: "Daniel Brown",
      email: "daniel@primehire.com",
      phone: "(555) 202-0001",
      currentCompany: "PrimeHire Group",
      companyId: COMPANY_2_ID,
      companyName: "PrimeHire Group",
      currentRole: "Platform Engineer",
      preferredJobType: "full_time",
      skills: ["Go", "Kubernetes", "Docker", "AWS", "Terraform", "REST"],
      experienceYears: 8,
      expectedHourlyRate: 95,
      location: "Chicago, IL",
      bio: "Platform engineering lead focused on service mesh and container orchestration.",
      resumeSummary:
        "8+ years in platform engineering, Go microservices, and K8s.",
      resumeExperience:
        "Principal Engineer at CloudStack (2019-2024)\nSr. Engineer at PlatformIQ (2016-2019)",
      resumeEducation: "M.S. CS, Northwestern (2016)",
      resumeAchievements:
        "Architected multi-region platform serving 10M+ daily requests.",
    },
    {
      candidateId: CAND_IDS[5],
      name: "Sophia Lee",
      email: "sophia@primehire.com",
      phone: "(555) 202-0002",
      currentCompany: "PrimeHire Group",
      companyId: COMPANY_2_ID,
      companyName: "PrimeHire Group",
      currentRole: "Frontend Developer",
      preferredJobType: "contract",
      skills: ["React", "Vue.js", "TypeScript", "GraphQL", "Node.js"],
      experienceYears: 4,
      expectedHourlyRate: 65,
      location: "Remote",
      bio: "UI/UX-focused frontend developer with design system experience.",
      resumeSummary:
        "4 years building design systems and component libraries in React & Vue.",
      resumeExperience:
        "Frontend Dev at PixelCraft (2022-2024)\nUI Engineer at DesignHub (2020-2022)",
      resumeEducation: "B.A. Interactive Media, UCLA (2020)",
      resumeAchievements:
        "Created company-wide design system adopted by 15 product teams.",
    },
    {
      candidateId: CAND_IDS[6],
      name: "Marcus Wilson",
      email: "marcus.w@primehire.com",
      phone: "(555) 202-0003",
      currentCompany: "PrimeHire Group",
      companyId: COMPANY_2_ID,
      companyName: "PrimeHire Group",
      currentRole: "Backend Engineer",
      preferredJobType: "full_time",
      skills: ["Java", "PostgreSQL", "MongoDB", "REST", "Docker", "Kafka"],
      experienceYears: 6,
      expectedHourlyRate: 80,
      location: "Denver, CO",
      bio: "Backend Java developer with experience in high-throughput transaction systems.",
      resumeSummary:
        "6 years building enterprise Java backends with Spring Boot.",
      resumeExperience:
        "Sr. Backend Dev at FinTechPro (2020-2024)\nBackend Dev at PayStream (2018-2020)",
      resumeEducation: "B.S. CS, CU Boulder (2018)",
      resumeAchievements:
        "Optimized payment processing pipeline, reducing latency by 60%.",
    },
    {
      candidateId: CAND_IDS[7],
      name: "Priya Sharma",
      email: "priya.sharma@primehire.com",
      phone: "(555) 202-0004",
      currentCompany: "PrimeHire Group",
      companyId: COMPANY_2_ID,
      companyName: "PrimeHire Group",
      currentRole: "Cloud Architect",
      preferredJobType: "contract",
      skills: ["AWS", "Terraform", "Kubernetes", "CI/CD", "Python", "Go"],
      experienceYears: 9,
      expectedHourlyRate: 110,
      location: "Boston, MA",
      bio: "Multi-cloud architect certified in AWS and GCP with enterprise migration experience.",
      resumeSummary:
        "9 years leading cloud migrations and building infrastructure-as-code.",
      resumeExperience:
        "Cloud Architect at CloudBridge (2018-2024)\nSr. AWS Engineer at SkyScale (2015-2018)",
      resumeEducation: "M.S. Cloud Computing, Boston Univ. (2015)",
      resumeAchievements:
        "Led $2M annual cost savings through cloud optimization and reserved instances.",
    },
  ];

  for (const p of profiles) {
    await prisma.candidateProfile.upsert({
      where: { candidateId: p.candidateId },
      create: {
        candidateId: p.candidateId,
        username: `${p.name.split(" ")[0]!.toLowerCase()}-${p.name.split(" ")[1]!.toLowerCase()}`,
        name: p.name,
        email: p.email,
        phone: p.phone,
        currentCompany: p.currentCompany,
        companyId: p.companyId,
        companyName: p.companyName,
        currentRole: p.currentRole,
        preferredJobType: p.preferredJobType,
        skills: p.skills,
        experienceYears: p.experienceYears,
        expectedHourlyRate: p.expectedHourlyRate,
        location: p.location,
        bio: p.bio,
        resumeSummary: p.resumeSummary,
        resumeExperience: p.resumeExperience,
        resumeEducation: p.resumeEducation,
        resumeAchievements: p.resumeAchievements,
      },
      update: {
        companyId: p.companyId,
        companyName: p.companyName,
      },
    });
  }

  console.log("  ✅ 8 candidate profiles (linked to companies)");

  // ── 5. Job Postings (mapped to sourceUserId and sourceCompanyId) ──────────

  const jobPostings = [
    // Posted by Vendor 1 — AcmeTech (mapped via sourceUserId for salary tracking)
    {
      vendorId: VENDOR_1_ID,
      vendorEmail: "hr@acmetech.com",
      recruiterName: "David Roberts",
      recruiterPhone: "(555) 300-0001",
      title: "Senior React Developer",
      description:
        "Build next-gen UI for our SaaS platform. React 18 + TypeScript.",
      location: "New York, NY",
      jobCountry: "US",
      jobType: "contract",
      jobSubType: "c2c",
      skillsRequired: ["React", "TypeScript", "Node.js", "GraphQL"],
      payPerHour: 90,
      experienceRequired: 5,
      sourceUserId: VENDOR_1_ID,
      sourceCompanyId: COMPANY_1_ID,
    },
    {
      vendorId: VENDOR_1_ID,
      vendorEmail: "hr@acmetech.com",
      recruiterName: "David Roberts",
      recruiterPhone: "(555) 300-0001",
      title: "Full Stack Engineer",
      description: "End-to-end feature development for our marketplace.",
      location: "San Francisco, CA",
      jobCountry: "US",
      jobType: "full_time",
      jobSubType: "w2",
      skillsRequired: ["Node.js", "React", "PostgreSQL", "Docker"],
      salaryMin: 120000,
      salaryMax: 160000,
      experienceRequired: 4,
      sourceUserId: VENDOR_1_ID,
      sourceCompanyId: COMPANY_1_ID,
    },
    {
      vendorId: VENDOR_1_ID,
      vendorEmail: "hr@acmetech.com",
      recruiterName: "David Roberts",
      recruiterPhone: "(555) 300-0001",
      title: "DevOps Engineer",
      description: "Manage CI/CD pipelines and cloud infrastructure on AWS.",
      location: "Austin, TX",
      jobCountry: "US",
      jobType: "contract",
      jobSubType: "c2h",
      skillsRequired: ["AWS", "Terraform", "Docker", "Kubernetes", "CI/CD"],
      payPerHour: 95,
      experienceRequired: 4,
      sourceUserId: VENDOR_1_ID,
      sourceCompanyId: COMPANY_1_ID,
    },
    {
      vendorId: VENDOR_1_ID,
      vendorEmail: "hr@acmetech.com",
      recruiterName: "David Roberts",
      recruiterPhone: "(555) 300-0001",
      title: "Data Engineer",
      description: "Design and maintain real-time data pipelines.",
      location: "Remote",
      jobCountry: "US",
      jobType: "contract",
      jobSubType: "c2c",
      skillsRequired: ["Python", "Kafka", "PostgreSQL", "Redis", "AWS"],
      payPerHour: 80,
      experienceRequired: 3,
      sourceUserId: VENDOR_1_ID,
      sourceCompanyId: COMPANY_1_ID,
    },
    {
      vendorId: VENDOR_1_ID,
      vendorEmail: "hr@acmetech.com",
      recruiterName: "David Roberts",
      recruiterPhone: "(555) 300-0001",
      title: "Backend Engineer (Node.js)",
      description: "Microservices development for high-traffic API.",
      location: "Chicago, IL",
      jobCountry: "US",
      jobType: "full_time",
      jobSubType: "w2",
      skillsRequired: [
        "Node.js",
        "TypeScript",
        "PostgreSQL",
        "Redis",
        "Docker",
      ],
      salaryMin: 130000,
      salaryMax: 170000,
      experienceRequired: 5,
      sourceUserId: VENDOR_1_ID,
      sourceCompanyId: COMPANY_1_ID,
    },
    {
      vendorId: VENDOR_1_ID,
      vendorEmail: "hr@acmetech.com",
      recruiterName: "David Roberts",
      recruiterPhone: "(555) 300-0001",
      title: "Cloud Architect",
      description:
        "Design multi-region cloud architecture for enterprise clients.",
      location: "Seattle, WA",
      jobCountry: "US",
      jobType: "contract",
      jobSubType: "c2c",
      skillsRequired: ["AWS", "Terraform", "Kubernetes", "Go", "Python"],
      payPerHour: 115,
      experienceRequired: 7,
      sourceUserId: VENDOR_1_ID,
      sourceCompanyId: COMPANY_1_ID,
    },
    // Posted by Vendor 2 — GlobalSoft
    {
      vendorId: VENDOR_2_ID,
      vendorEmail: "recruit@globalsoft.io",
      recruiterName: "Emily Park",
      recruiterPhone: "(555) 400-0001",
      title: "Frontend Developer",
      description: "Component library development with React and Storybook.",
      location: "Remote",
      jobCountry: "US",
      jobType: "contract",
      jobSubType: "c2c",
      skillsRequired: ["React", "TypeScript", "Vue.js", "GraphQL"],
      payPerHour: 70,
      experienceRequired: 3,
      sourceUserId: VENDOR_2_ID,
      sourceCompanyId: COMPANY_2_ID,
    },
    {
      vendorId: VENDOR_2_ID,
      vendorEmail: "recruit@globalsoft.io",
      recruiterName: "Emily Park",
      recruiterPhone: "(555) 400-0001",
      title: "Platform Engineer",
      description: "Build internal developer platform with service mesh.",
      location: "Denver, CO",
      jobCountry: "US",
      jobType: "full_time",
      jobSubType: "w2",
      skillsRequired: ["Go", "Kubernetes", "Docker", "AWS", "Terraform"],
      salaryMin: 140000,
      salaryMax: 180000,
      experienceRequired: 6,
      sourceUserId: VENDOR_2_ID,
      sourceCompanyId: COMPANY_2_ID,
    },
    {
      vendorId: VENDOR_2_ID,
      vendorEmail: "recruit@globalsoft.io",
      recruiterName: "Emily Park",
      recruiterPhone: "(555) 400-0001",
      title: "SRE — Site Reliability Engineer",
      description: "Ensure 99.99% uptime for mission-critical systems.",
      location: "Boston, MA",
      jobCountry: "US",
      jobType: "contract",
      jobSubType: "c2h",
      skillsRequired: ["AWS", "Kubernetes", "Python", "CI/CD", "Terraform"],
      payPerHour: 100,
      experienceRequired: 5,
      sourceUserId: VENDOR_2_ID,
      sourceCompanyId: COMPANY_2_ID,
    },
    {
      vendorId: VENDOR_2_ID,
      vendorEmail: "recruit@globalsoft.io",
      recruiterName: "Emily Park",
      recruiterPhone: "(555) 400-0001",
      title: "Software Engineer II",
      description: "Feature development for B2B SaaS product.",
      location: "Atlanta, GA",
      jobCountry: "US",
      jobType: "full_time",
      jobSubType: "w2",
      skillsRequired: ["Java", "PostgreSQL", "REST", "Docker", "MongoDB"],
      salaryMin: 100000,
      salaryMax: 140000,
      experienceRequired: 3,
      sourceUserId: VENDOR_2_ID,
      sourceCompanyId: COMPANY_2_ID,
    },
    {
      vendorId: VENDOR_2_ID,
      vendorEmail: "recruit@globalsoft.io",
      recruiterName: "Emily Park",
      recruiterPhone: "(555) 400-0001",
      title: "Lead TypeScript Developer",
      description:
        "Lead a team of 5 engineers building a real-time collaboration tool.",
      location: "Los Angeles, CA",
      jobCountry: "US",
      jobType: "full_time",
      jobSubType: "w2",
      skillsRequired: ["TypeScript", "React", "Node.js", "PostgreSQL", "Redis"],
      salaryMin: 150000,
      salaryMax: 200000,
      experienceRequired: 7,
      sourceUserId: VENDOR_2_ID,
      sourceCompanyId: COMPANY_2_ID,
    },
    {
      vendorId: VENDOR_2_ID,
      vendorEmail: "recruit@globalsoft.io",
      recruiterName: "Emily Park",
      recruiterPhone: "(555) 400-0001",
      title: "API Engineer",
      description:
        "Design and build RESTful and GraphQL APIs serving millions of requests.",
      location: "Chicago, IL",
      jobCountry: "US",
      jobType: "contract",
      jobSubType: "c2c",
      skillsRequired: ["Node.js", "GraphQL", "REST", "PostgreSQL", "Redis"],
      payPerHour: 85,
      experienceRequired: 4,
      sourceUserId: VENDOR_2_ID,
      sourceCompanyId: COMPANY_2_ID,
    },
  ];

  for (const jp of jobPostings) {
    // Use title + vendorEmail as soft-dedupe key
    const existing = await prisma.job.findFirst({
      where: { title: jp.title, vendorEmail: jp.vendorEmail },
    });
    if (!existing) {
      await prisma.job.create({
        data: {
          vendorId: jp.vendorId,
          vendorEmail: jp.vendorEmail,
          recruiterName: jp.recruiterName,
          recruiterPhone: jp.recruiterPhone,
          title: jp.title,
          description: jp.description,
          location: jp.location,
          jobCountry: jp.jobCountry,
          jobType: jp.jobType,
          jobSubType: jp.jobSubType || "",
          skillsRequired: jp.skillsRequired,
          payPerHour: jp.payPerHour ?? null,
          salaryMin: jp.salaryMin ?? null,
          salaryMax: jp.salaryMax ?? null,
          experienceRequired: jp.experienceRequired,
          isActive: true,
          sourceUserId: jp.sourceUserId,
          sourceCompanyId: jp.sourceCompanyId,
        },
      });
    }
  }

  console.log(
    "  ✅ 12 job postings (6 per vendor, with sourceUserId & sourceCompanyId)",
  );

  // ── 6. Forwarded Openings ─────────────────────────────────────────────────

  // Get actual job IDs to forward
  const allJobs = await prisma.job.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "asc" },
    take: 12,
  });

  if (allJobs.length >= 6) {
    const forwardData = [
      // Marketer 1 forwards jobs to their candidates
      {
        marketerId: MARKETER_1_ID,
        marketerEmail: "sarah@techstaff.io",
        companyId: COMPANY_1_ID,
        companyName: "TechStaff Solutions",
        candidateEmail: "alex@techstaff.io",
        candidateName: "Alex Johnson",
        job: allJobs[0]!,
        note: "Great match for your React skills!",
        status: "pending",
      },
      {
        marketerId: MARKETER_1_ID,
        marketerEmail: "sarah@techstaff.io",
        companyId: COMPANY_1_ID,
        companyName: "TechStaff Solutions",
        candidateEmail: "maria@techstaff.io",
        candidateName: "Maria Garcia",
        job: allJobs[1]!,
        note: "Full stack role — perfect fit",
        status: "applied",
      },
      {
        marketerId: MARKETER_1_ID,
        marketerEmail: "sarah@techstaff.io",
        companyId: COMPANY_1_ID,
        companyName: "TechStaff Solutions",
        candidateEmail: "ryan.patel@techstaff.io",
        candidateName: "Ryan Patel",
        job: allJobs[2]!,
        note: "DevOps role with great pay",
        status: "pending",
      },
      // Marketer 2 forwards jobs to their candidates
      {
        marketerId: MARKETER_2_ID,
        marketerEmail: "james@primehire.com",
        companyId: COMPANY_2_ID,
        companyName: "PrimeHire Group",
        candidateEmail: "daniel@primehire.com",
        candidateName: "Daniel Brown",
        job: allJobs[7]!,
        note: "Platform eng role — your specialty",
        status: "hired",
      },
      {
        marketerId: MARKETER_2_ID,
        marketerEmail: "james@primehire.com",
        companyId: COMPANY_2_ID,
        companyName: "PrimeHire Group",
        candidateEmail: "sophia@primehire.com",
        candidateName: "Sophia Lee",
        job: allJobs[6]!,
        note: "Frontend role — remote!",
        status: "pending",
      },
      {
        marketerId: MARKETER_2_ID,
        marketerEmail: "james@primehire.com",
        companyId: COMPANY_2_ID,
        companyName: "PrimeHire Group",
        candidateEmail: "priya.sharma@primehire.com",
        candidateName: "Priya Sharma",
        job: allJobs[8]!,
        note: "SRE role with great compensation",
        status: "applied",
      },
    ];

    for (const fd of forwardData) {
      const j = fd.job;
      await prisma.forwardedOpening.upsert({
        where: {
          marketerId_candidateEmail_jobId: {
            marketerId: fd.marketerId,
            candidateEmail: fd.candidateEmail,
            jobId: j.id,
          },
        },
        create: {
          marketerId: fd.marketerId,
          marketerEmail: fd.marketerEmail,
          companyId: fd.companyId,
          companyName: fd.companyName,
          candidateEmail: fd.candidateEmail,
          candidateName: fd.candidateName,
          jobId: j.id,
          jobTitle: j.title,
          jobLocation: j.location,
          jobType: j.jobType,
          jobSubType: j.jobSubType,
          vendorEmail: j.vendorEmail,
          skillsRequired: j.skillsRequired,
          payPerHour: j.payPerHour || null,
          salaryMin: j.salaryMin || null,
          salaryMax: j.salaryMax || null,
          note: fd.note,
          status: fd.status,
        },
        update: {},
      });
    }

    console.log("  ✅ 6 forwarded openings (3 per marketer)");
  }

  // ── 7. Company Invites ────────────────────────────────────────────────────

  const inviteData = [
    {
      companyId: COMPANY_1_ID,
      companyName: "TechStaff Solutions",
      marketerId: MARKETER_1_ID,
      marketerEmail: "sarah@techstaff.io",
      candidateEmail: "ryan.patel@techstaff.io",
      candidateName: "Ryan Patel",
      offerNote:
        "Join our growing DevOps team! We offer competitive rates and flexible hours.",
      status: "pending",
    },
    {
      companyId: COMPANY_2_ID,
      companyName: "PrimeHire Group",
      marketerId: MARKETER_2_ID,
      marketerEmail: "james@primehire.com",
      candidateEmail: "marcus.w@primehire.com",
      candidateName: "Marcus Wilson",
      offerNote:
        "We have several backend positions that match your skillset. Let's connect!",
      status: "pending",
    },
  ];

  for (const inv of inviteData) {
    await prisma.companyInvite.upsert({
      where: {
        companyId_candidateEmail: {
          companyId: inv.companyId,
          candidateEmail: inv.candidateEmail,
        },
      },
      create: {
        ...inv,
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      },
      update: {},
    });
  }

  console.log("  ✅ 2 company invites (1 per marketer)");

  console.log("\n🎉 Seed complete! Mock data ready for development.\n");
  console.log(
    "  Login credentials (all passwords are mocked — use the register_user.ps1 script for real accounts):",
  );
  console.log("  Marketer 1: sarah@techstaff.io    (TechStaff Solutions)");
  console.log("  Marketer 2: james@primehire.com   (PrimeHire Group)");
  console.log("  Vendor 1:   hr@acmetech.com");
  console.log("  Vendor 2:   recruit@globalsoft.io");
  console.log("  Candidates: alex@techstaff.io, maria@techstaff.io, ...\n");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
