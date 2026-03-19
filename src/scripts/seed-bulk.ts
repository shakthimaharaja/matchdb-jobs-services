/**
 * seed-bulk.ts — APPENDS bulk test data to the jobs database.
 * Run AFTER the base `npm run seed` so the admin accounts, companies, and
 * base candidates already exist.
 *
 * Adds:
 *   30 new job openings for admin@vendor.com
 *   20 new candidate profiles (C11–C30)
 *   ~46 applications linking new candidates to jobs
 *   20 marketer-candidate roster links for admin@marketer.com
 *   20 forwarded openings
 *   15 project financials
 *   30 timesheets
 *   20 poke records
 *   10 interview invites
 *
 * Usage:  npm run seed:bulk
 */
import mongoose from "mongoose";
import { connectMongo, disconnectMongo } from "../config/mongoose";
import {
  Job,
  CandidateProfile,
  Application,
  PokeRecord,
  PokeLog,
  Company,
  MarketerCandidate,
  ForwardedOpening,
  ProjectFinancial,
  Timesheet,
  InterviewInvite,
  ClientCompany,
  VendorCompany,
} from "../models";

/* ── helpers ────────────────────────────────────────────────────────── */
const oid = () => new mongoose.Types.ObjectId().toString();
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);
const daysFromNow = (n: number) => new Date(Date.now() + n * 86_400_000);
const monday = (weeksAgo: number) => {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay() + 1 - weeksAgo * 7);
  d.setHours(0, 0, 0, 0);
  return d;
};

/* ── shared IDs from the base seed ──────────────────────────────────── */
const ADMIN_VENDOR = "aaaaaaaa-0001-0001-0001-aaaaaaaaaaaa";
const ADMIN_MARKETER = "aaaaaaaa-0002-0002-0002-aaaaaaaaaaaa";

/* ── new candidate IDs — must match shell-services seed-bulk ────────── */
const C11 = "cccccccc-0011-0011-0011-cccccccccccc";
const C12 = "cccccccc-0012-0012-0012-cccccccccccc";
const C13 = "cccccccc-0013-0013-0013-cccccccccccc";
const C14 = "cccccccc-0014-0014-0014-cccccccccccc";
const C15 = "cccccccc-0015-0015-0015-cccccccccccc";
const C16 = "cccccccc-0016-0016-0016-cccccccccccc";
const C17 = "cccccccc-0017-0017-0017-cccccccccccc";
const C18 = "cccccccc-0018-0018-0018-cccccccccccc";
const C19 = "cccccccc-0019-0019-0019-cccccccccccc";
const C20 = "cccccccc-0020-0020-0020-cccccccccccc";
const C21 = "cccccccc-0021-0021-0021-cccccccccccc";
const C22 = "cccccccc-0022-0022-0022-cccccccccccc";
const C23 = "cccccccc-0023-0023-0023-cccccccccccc";
const C24 = "cccccccc-0024-0024-0024-cccccccccccc";
const C25 = "cccccccc-0025-0025-0025-cccccccccccc";
const C26 = "cccccccc-0026-0026-0026-cccccccccccc";
const C27 = "cccccccc-0027-0027-0027-cccccccccccc";
const C28 = "cccccccc-0028-0028-0028-cccccccccccc";
const C29 = "cccccccc-0029-0029-0029-cccccccccccc";
const C30 = "cccccccc-0030-0030-0030-cccccccccccc";

/* ── financial helper ───────────────────────────────────────────────── */
function fin(
  billRate: number,
  payRate: number,
  hours: number,
  taxPct: number,
  cashPct: number,
  paid: number,
) {
  const totalBilled = billRate * hours;
  const totalPay = payRate * hours;
  const taxAmount = Math.round(totalPay * taxPct) / 100;
  const cashAmount = Math.round(totalPay * cashPct) / 100;
  const netPayable = totalPay - taxAmount - cashAmount;
  return {
    billRate,
    payRate,
    hoursWorked: hours,
    totalBilled,
    totalPay,
    taxAmount,
    cashAmount,
    netPayable,
    amountPaid: paid,
    amountPending: Math.round((netPayable - paid) * 100) / 100,
  };
}

/* ================================================================== */
async function seedBulk() {
  await connectMongo();
  console.log("🌱 Bulk-seeding matchdb-jobs database...\n");

  /* look up existing company for admin marketer */
  const company = await Company.findOne({ marketerId: ADMIN_MARKETER }).lean();
  if (!company) {
    console.error(
      "❌  Company for admin@marketer.com not found. Run base seed first.",
    );
    process.exit(1);
  }
  const COMPANY_ID = company._id as string;
  const COMPANY_NAME = (company as { name: string }).name; // "Alpha Staffing Solutions"

  /* ================================================================ */
  /*  CLEAN UP previous bulk-seed data                                 */
  /* ================================================================ */
  const BULK_CANDIDATE_IDS = [
    C11,
    C12,
    C13,
    C14,
    C15,
    C16,
    C17,
    C18,
    C19,
    C20,
    C21,
    C22,
    C23,
    C24,
    C25,
    C26,
    C27,
    C28,
    C29,
    C30,
  ];
  await Job.deleteMany({ vendorId: ADMIN_VENDOR });
  await CandidateProfile.deleteMany({
    candidateId: { $in: BULK_CANDIDATE_IDS },
  });
  await Application.deleteMany({ candidateId: { $in: BULK_CANDIDATE_IDS } });
  await MarketerCandidate.deleteMany({ marketerId: ADMIN_MARKETER });
  await ForwardedOpening.deleteMany({ marketerId: ADMIN_MARKETER });
  await ProjectFinancial.deleteMany({ marketerId: ADMIN_MARKETER });
  await Timesheet.deleteMany({ marketerId: ADMIN_MARKETER });
  await PokeRecord.deleteMany({
    $or: [
      {
        senderId: {
          $in: [ADMIN_VENDOR, ADMIN_MARKETER, ...BULK_CANDIDATE_IDS],
        },
      },
      {
        targetId: {
          $in: [ADMIN_VENDOR, ADMIN_MARKETER, ...BULK_CANDIDATE_IDS],
        },
      },
    ],
  });
  await PokeLog.deleteMany({ userId: { $in: BULK_CANDIDATE_IDS } });
  await InterviewInvite.deleteMany({ vendorId: ADMIN_VENDOR });
  await ClientCompany.deleteMany({ marketerId: ADMIN_MARKETER });
  await VendorCompany.deleteMany({ marketerId: ADMIN_MARKETER });
  console.log("  ✓ Cleaned up previous bulk-seed data");

  /* ================================================================ */
  /*  CLIENT & VENDOR COMPANIES — lookup tables                        */
  /* ================================================================ */

  const CC_GOOGLE = oid();
  const CC_AMAZON = oid();
  const CC_META = oid();
  const CC_MICROSOFT = oid();
  const CC_NETFLIX = oid();

  const clientCompanies = await ClientCompany.insertMany([
    { _id: CC_GOOGLE, name: "Google", marketerId: ADMIN_MARKETER },
    { _id: CC_AMAZON, name: "Amazon", marketerId: ADMIN_MARKETER },
    { _id: CC_META, name: "Meta", marketerId: ADMIN_MARKETER },
    { _id: CC_MICROSOFT, name: "Microsoft", marketerId: ADMIN_MARKETER },
    { _id: CC_NETFLIX, name: "Netflix", marketerId: ADMIN_MARKETER },
  ]);
  console.log(`  ✓ Created ${clientCompanies.length} client companies`);

  const ccByName: Record<string, string> = {
    Google: CC_GOOGLE,
    Amazon: CC_AMAZON,
    Meta: CC_META,
    Microsoft: CC_MICROSOFT,
    Netflix: CC_NETFLIX,
  };

  const VC_TECHBRIDGE = oid();
  const VC_PINNACLE = oid();
  const VC_APEX = oid();
  const VC_SECURENET = oid();

  const vendorCompanies = await VendorCompany.insertMany([
    {
      _id: VC_TECHBRIDGE,
      name: "TechBridge Staffing",
      marketerId: ADMIN_MARKETER,
    },
    {
      _id: VC_PINNACLE,
      name: "Pinnacle Solutions",
      marketerId: ADMIN_MARKETER,
    },
    { _id: VC_APEX, name: "Apex Digital", marketerId: ADMIN_MARKETER },
    {
      _id: VC_SECURENET,
      name: "SecureNet Partners",
      marketerId: ADMIN_MARKETER,
    },
  ]);
  console.log(`  ✓ Created ${vendorCompanies.length} vendor companies`);

  const vcByName: Record<string, string> = {
    "TechBridge Staffing": VC_TECHBRIDGE,
    "Pinnacle Solutions": VC_PINNACLE,
    "Apex Digital": VC_APEX,
    "SecureNet Partners": VC_SECURENET,
  };

  /* Client assignment for jobs — distributes 30 jobs across clients */
  const jobClientCycle = [
    CC_GOOGLE, // BJ[0]
    CC_AMAZON, // BJ[1]
    CC_MICROSOFT, // BJ[2]
    CC_AMAZON, // BJ[3]
    CC_AMAZON, // BJ[4]
    CC_NETFLIX, // BJ[5]
    CC_GOOGLE, // BJ[6]
    CC_MICROSOFT, // BJ[7]
    CC_META, // BJ[8]
    CC_GOOGLE, // BJ[9]
    CC_GOOGLE, // BJ[10]
    CC_META, // BJ[11]
    CC_MICROSOFT, // BJ[12]
    CC_AMAZON, // BJ[13]
    CC_NETFLIX, // BJ[14]
    CC_GOOGLE, // BJ[15]
    CC_AMAZON, // BJ[16]
    CC_META, // BJ[17]
    CC_MICROSOFT, // BJ[18]
    CC_GOOGLE, // BJ[19]
    CC_AMAZON, // BJ[20]
    CC_NETFLIX, // BJ[21]
    CC_META, // BJ[22]
    CC_GOOGLE, // BJ[23]
    CC_MICROSOFT, // BJ[24]
    CC_AMAZON, // BJ[25]
    CC_META, // BJ[26]
    CC_GOOGLE, // BJ[27]
    CC_AMAZON, // BJ[28]
    CC_NETFLIX, // BJ[29]
  ];

  /* ================================================================ */
  /*  30 NEW JOBS — all posted by admin@vendor.com                     */
  /* ================================================================ */
  const BJ = Array.from({ length: 30 }, () => oid());

  const bulkJobs = await Job.insertMany([
    {
      _id: BJ[0],
      vendorId: ADMIN_VENDOR,
      vendorEmail: "admin@vendor.com",
      recruiterName: "Admin Vendor",
      recruiterPhone: "555-100-0001",
      title: "Senior Vue.js Developer",
      description:
        "Build a next-gen e-commerce platform using Vue 3, Pinia, and Vite. Strong CSS & accessibility.",
      location: "Remote",
      jobCountry: "US",
      jobState: "",
      jobCity: "",
      jobType: "w2",
      jobSubType: "salary",
      workMode: "remote",
      salaryMin: 130000,
      salaryMax: 160000,
      skillsRequired: ["Vue.js", "TypeScript", "Pinia", "CSS", "REST APIs"],
      experienceRequired: 4,
      isActive: true,
      sourceUserId: ADMIN_VENDOR,
    },
    {
      _id: BJ[1],
      vendorId: ADMIN_VENDOR,
      vendorEmail: "admin@vendor.com",
      recruiterName: "Admin Vendor",
      recruiterPhone: "555-100-0001",
      title: "Backend Python Engineer",
      description:
        "Django + FastAPI microservices with PostgreSQL and Redis. Strong testing culture.",
      location: "New York, NY",
      jobCountry: "US",
      jobState: "NY",
      jobCity: "New York",
      jobType: "c2c",
      jobSubType: "contract",
      workMode: "hybrid",
      payPerHour: 90,
      skillsRequired: ["Python", "Django", "FastAPI", "PostgreSQL", "Redis"],
      experienceRequired: 5,
      isActive: true,
      sourceUserId: ADMIN_VENDOR,
    },
    {
      _id: BJ[2],
      vendorId: ADMIN_VENDOR,
      vendorEmail: "admin@vendor.com",
      recruiterName: "Admin Vendor",
      recruiterPhone: "555-100-0001",
      title: "Platform Engineer",
      description:
        "Build and maintain internal platform with Kubernetes, AWS, and Terraform. Developer experience focus.",
      location: "San Francisco, CA",
      jobCountry: "US",
      jobState: "CA",
      jobCity: "San Francisco",
      jobType: "w2",
      jobSubType: "salary",
      workMode: "hybrid",
      salaryMin: 150000,
      salaryMax: 190000,
      skillsRequired: ["Kubernetes", "AWS", "Terraform", "Go", "CI/CD"],
      experienceRequired: 6,
      isActive: true,
      sourceUserId: ADMIN_VENDOR,
    },
    {
      _id: BJ[3],
      vendorId: ADMIN_VENDOR,
      vendorEmail: "admin@vendor.com",
      recruiterName: "Admin Vendor",
      recruiterPhone: "555-100-0001",
      title: "Android Mobile Developer",
      description:
        "Kotlin-first Android app with Jetpack Compose. Firebase backend integration.",
      location: "Austin, TX",
      jobCountry: "US",
      jobState: "TX",
      jobCity: "Austin",
      jobType: "1099",
      jobSubType: "hourly",
      workMode: "remote",
      payPerHour: 75,
      skillsRequired: [
        "Kotlin",
        "Android",
        "Jetpack Compose",
        "Firebase",
        "REST APIs",
      ],
      experienceRequired: 4,
      isActive: true,
      sourceUserId: ADMIN_VENDOR,
    },
    {
      _id: BJ[4],
      vendorId: ADMIN_VENDOR,
      vendorEmail: "admin@vendor.com",
      recruiterName: "Admin Vendor",
      recruiterPhone: "555-100-0001",
      title: "Senior Java Microservices Developer",
      description:
        "Spring Boot microservices with Kafka event streaming. PostgreSQL & Kubernetes deployment.",
      location: "Chicago, IL",
      jobCountry: "US",
      jobState: "IL",
      jobCity: "Chicago",
      jobType: "w2",
      jobSubType: "salary",
      workMode: "onsite",
      salaryMin: 140000,
      salaryMax: 175000,
      skillsRequired: [
        "Java",
        "Spring Boot",
        "Kafka",
        "PostgreSQL",
        "Microservices",
      ],
      experienceRequired: 6,
      isActive: true,
      sourceUserId: ADMIN_VENDOR,
    },
    {
      _id: BJ[5],
      vendorId: ADMIN_VENDOR,
      vendorEmail: "admin@vendor.com",
      recruiterName: "Admin Vendor",
      recruiterPhone: "555-100-0001",
      title: "Kubernetes Platform Lead",
      description:
        "Lead container platform team. Helm charts, ArgoCD GitOps, multi-cluster management.",
      location: "Seattle, WA",
      jobCountry: "US",
      jobState: "WA",
      jobCity: "Seattle",
      jobType: "c2c",
      jobSubType: "contract",
      workMode: "hybrid",
      payPerHour: 110,
      skillsRequired: ["Kubernetes", "Helm", "ArgoCD", "Terraform", "AWS"],
      experienceRequired: 7,
      isActive: true,
      sourceUserId: ADMIN_VENDOR,
    },
    {
      _id: BJ[6],
      vendorId: ADMIN_VENDOR,
      vendorEmail: "admin@vendor.com",
      recruiterName: "Admin Vendor",
      recruiterPhone: "555-100-0001",
      title: "AI / LLM Engineer",
      description:
        "Build production LLM pipelines with RAG, fine-tuning, and vector databases. OpenAI & local models.",
      location: "Remote",
      jobCountry: "US",
      jobState: "",
      jobCity: "",
      jobType: "w2",
      jobSubType: "salary",
      workMode: "remote",
      salaryMin: 170000,
      salaryMax: 220000,
      skillsRequired: ["Python", "LLM", "LangChain", "Vector DB", "OpenAI"],
      experienceRequired: 4,
      isActive: true,
      sourceUserId: ADMIN_VENDOR,
    },
    {
      _id: BJ[7],
      vendorId: ADMIN_VENDOR,
      vendorEmail: "admin@vendor.com",
      recruiterName: "Admin Vendor",
      recruiterPhone: "555-100-0001",
      title: "Rust Systems Programmer",
      description:
        "Low-level systems programming for a high-frequency networking stack. Linux kernel experience a plus.",
      location: "Boston, MA",
      jobCountry: "US",
      jobState: "MA",
      jobCity: "Boston",
      jobType: "1099",
      jobSubType: "hourly",
      workMode: "onsite",
      payPerHour: 100,
      skillsRequired: [
        "Rust",
        "Systems Programming",
        "Linux",
        "Networking",
        "C",
      ],
      experienceRequired: 5,
      isActive: true,
      sourceUserId: ADMIN_VENDOR,
    },
    {
      _id: BJ[8],
      vendorId: ADMIN_VENDOR,
      vendorEmail: "admin@vendor.com",
      recruiterName: "Admin Vendor",
      recruiterPhone: "555-100-0001",
      title: "Data Platform Architect",
      description:
        "Design data lakehouse architecture. Snowflake, dbt, and Airflow orchestration.",
      location: "Denver, CO",
      jobCountry: "US",
      jobState: "CO",
      jobCity: "Denver",
      jobType: "w2",
      jobSubType: "salary",
      workMode: "hybrid",
      salaryMin: 160000,
      salaryMax: 200000,
      skillsRequired: ["Snowflake", "dbt", "Airflow", "Python", "SQL"],
      experienceRequired: 7,
      isActive: true,
      sourceUserId: ADMIN_VENDOR,
    },
    {
      _id: BJ[9],
      vendorId: ADMIN_VENDOR,
      vendorEmail: "admin@vendor.com",
      recruiterName: "Admin Vendor",
      recruiterPhone: "555-100-0001",
      title: "React Native Team Lead",
      description:
        "Lead a cross-platform mobile team. React Native, TypeScript, CI/CD for App Store releases.",
      location: "Miami, FL",
      jobCountry: "US",
      jobState: "FL",
      jobCity: "Miami",
      jobType: "w2",
      jobSubType: "salary",
      workMode: "hybrid",
      salaryMin: 145000,
      salaryMax: 180000,
      skillsRequired: ["React Native", "TypeScript", "Redux", "iOS", "Android"],
      experienceRequired: 5,
      isActive: true,
      sourceUserId: ADMIN_VENDOR,
    },
    {
      _id: BJ[10],
      vendorId: ADMIN_VENDOR,
      vendorEmail: "admin@vendor.com",
      recruiterName: "Admin Vendor",
      recruiterPhone: "555-100-0001",
      title: ".NET Backend Developer",
      description:
        "C# microservices on Azure with SQL Server and Service Bus messaging.",
      location: "Atlanta, GA",
      jobCountry: "US",
      jobState: "GA",
      jobCity: "Atlanta",
      jobType: "c2c",
      jobSubType: "contract",
      workMode: "remote",
      payPerHour: 85,
      skillsRequired: ["C#", ".NET", "Azure", "SQL Server", "Microservices"],
      experienceRequired: 5,
      isActive: true,
      sourceUserId: ADMIN_VENDOR,
    },
    {
      _id: BJ[11],
      vendorId: ADMIN_VENDOR,
      vendorEmail: "admin@vendor.com",
      recruiterName: "Admin Vendor",
      recruiterPhone: "555-100-0001",
      title: "Tableau BI Developer",
      description:
        "Executive dashboards and data storytelling. SQL + Python ETL support.",
      location: "Portland, OR",
      jobCountry: "US",
      jobState: "OR",
      jobCity: "Portland",
      jobType: "1099",
      jobSubType: "hourly",
      workMode: "remote",
      payPerHour: 70,
      skillsRequired: ["Tableau", "SQL", "Python", "Data Modeling", "ETL"],
      experienceRequired: 3,
      isActive: true,
      sourceUserId: ADMIN_VENDOR,
    },
    {
      _id: BJ[12],
      vendorId: ADMIN_VENDOR,
      vendorEmail: "admin@vendor.com",
      recruiterName: "Admin Vendor",
      recruiterPhone: "555-100-0001",
      title: "AWS Solutions Architect",
      description:
        "Design multi-account AWS landing zones. CloudFormation, networking, and security foundations.",
      location: "Washington, DC",
      jobCountry: "US",
      jobState: "DC",
      jobCity: "Washington",
      jobType: "w2",
      jobSubType: "salary",
      workMode: "onsite",
      salaryMin: 165000,
      salaryMax: 210000,
      skillsRequired: [
        "AWS",
        "Architecture",
        "CloudFormation",
        "Networking",
        "Security",
      ],
      experienceRequired: 8,
      isActive: true,
      sourceUserId: ADMIN_VENDOR,
    },
    {
      _id: BJ[13],
      vendorId: ADMIN_VENDOR,
      vendorEmail: "admin@vendor.com",
      recruiterName: "Admin Vendor",
      recruiterPhone: "555-100-0001",
      title: "Scrum Master / Agile Coach",
      description:
        "Coach 3 product teams. Agile transformation, retrospectives, and SAFe ceremonies.",
      location: "New York, NY",
      jobCountry: "US",
      jobState: "NY",
      jobCity: "New York",
      jobType: "w2",
      jobSubType: "salary",
      workMode: "hybrid",
      salaryMin: 130000,
      salaryMax: 160000,
      skillsRequired: ["Agile", "Scrum", "JIRA", "Coaching", "SAFe"],
      experienceRequired: 5,
      isActive: true,
      sourceUserId: ADMIN_VENDOR,
    },
    {
      _id: BJ[14],
      vendorId: ADMIN_VENDOR,
      vendorEmail: "admin@vendor.com",
      recruiterName: "Admin Vendor",
      recruiterPhone: "555-100-0001",
      title: "PostgreSQL Database Administrator",
      description:
        "Manage production PostgreSQL clusters. Performance tuning, replication, backups, and disaster recovery.",
      location: "Dallas, TX",
      jobCountry: "US",
      jobState: "TX",
      jobCity: "Dallas",
      jobType: "c2c",
      jobSubType: "contract",
      workMode: "hybrid",
      payPerHour: 80,
      skillsRequired: [
        "PostgreSQL",
        "MySQL",
        "Performance Tuning",
        "Replication",
        "Backup",
      ],
      experienceRequired: 6,
      isActive: true,
      sourceUserId: ADMIN_VENDOR,
    },
    {
      _id: BJ[15],
      vendorId: ADMIN_VENDOR,
      vendorEmail: "admin@vendor.com",
      recruiterName: "Admin Vendor",
      recruiterPhone: "555-100-0001",
      title: "Salesforce Developer",
      description:
        "Apex triggers, Lightning components, and SOQL-based integrations for a CPQ implementation.",
      location: "San Diego, CA",
      jobCountry: "US",
      jobState: "CA",
      jobCity: "San Diego",
      jobType: "1099",
      jobSubType: "hourly",
      workMode: "hybrid",
      payPerHour: 75,
      skillsRequired: [
        "Salesforce",
        "Apex",
        "Lightning",
        "SOQL",
        "Integration",
      ],
      experienceRequired: 4,
      isActive: true,
      sourceUserId: ADMIN_VENDOR,
    },
    {
      _id: BJ[16],
      vendorId: ADMIN_VENDOR,
      vendorEmail: "admin@vendor.com",
      recruiterName: "Admin Vendor",
      recruiterPhone: "555-100-0001",
      title: "NLP Research Engineer",
      description:
        "Transformer fine-tuning, RAG pipelines, and evaluation harnesses. Research-to-production focus.",
      location: "Seattle, WA",
      jobCountry: "US",
      jobState: "WA",
      jobCity: "Seattle",
      jobType: "w2",
      jobSubType: "salary",
      workMode: "hybrid",
      salaryMin: 160000,
      salaryMax: 200000,
      skillsRequired: [
        "Python",
        "NLP",
        "Transformers",
        "PyTorch",
        "HuggingFace",
      ],
      experienceRequired: 4,
      isActive: true,
      sourceUserId: ADMIN_VENDOR,
    },
    {
      _id: BJ[17],
      vendorId: ADMIN_VENDOR,
      vendorEmail: "admin@vendor.com",
      recruiterName: "Admin Vendor",
      recruiterPhone: "555-100-0001",
      title: "IoT Firmware Developer",
      description:
        "BLE and Wi-Fi firmware for wearable medical devices. C/C++ and RTOS.",
      location: "Austin, TX",
      jobCountry: "US",
      jobState: "TX",
      jobCity: "Austin",
      jobType: "1099",
      jobSubType: "hourly",
      workMode: "onsite",
      payPerHour: 85,
      skillsRequired: ["C", "C++", "RTOS", "BLE", "Embedded Systems"],
      experienceRequired: 5,
      isActive: true,
      sourceUserId: ADMIN_VENDOR,
    },
    {
      _id: BJ[18],
      vendorId: ADMIN_VENDOR,
      vendorEmail: "admin@vendor.com",
      recruiterName: "Admin Vendor",
      recruiterPhone: "555-100-0001",
      title: "SAP ABAP Consultant",
      description:
        "S/4HANA migration and Fiori custom app development. Integration with legacy systems.",
      location: "Remote",
      jobCountry: "US",
      jobState: "",
      jobCity: "",
      jobType: "c2c",
      jobSubType: "contract",
      workMode: "remote",
      payPerHour: 95,
      skillsRequired: ["SAP", "ABAP", "S/4HANA", "Fiori", "Integration"],
      experienceRequired: 6,
      isActive: true,
      sourceUserId: ADMIN_VENDOR,
    },
    {
      _id: BJ[19],
      vendorId: ADMIN_VENDOR,
      vendorEmail: "admin@vendor.com",
      recruiterName: "Admin Vendor",
      recruiterPhone: "555-100-0001",
      title: "Ruby on Rails Developer",
      description:
        "Full-stack Rails 7 with Hotwire/Turbo. PostgreSQL and Sidekiq background jobs.",
      location: "San Francisco, CA",
      jobCountry: "US",
      jobState: "CA",
      jobCity: "San Francisco",
      jobType: "w2",
      jobSubType: "salary",
      workMode: "remote",
      salaryMin: 130000,
      salaryMax: 165000,
      skillsRequired: ["Ruby", "Rails", "PostgreSQL", "Redis", "JavaScript"],
      experienceRequired: 4,
      isActive: true,
      sourceUserId: ADMIN_VENDOR,
    },
    {
      _id: BJ[20],
      vendorId: ADMIN_VENDOR,
      vendorEmail: "admin@vendor.com",
      recruiterName: "Admin Vendor",
      recruiterPhone: "555-100-0001",
      title: "QA Automation Architect",
      description:
        "Architect test infrastructure across 5 product teams. Selenium Grid, Playwright, and API testing.",
      location: "Chicago, IL",
      jobCountry: "US",
      jobState: "IL",
      jobCity: "Chicago",
      jobType: "w2",
      jobSubType: "salary",
      workMode: "hybrid",
      salaryMin: 125000,
      salaryMax: 155000,
      skillsRequired: [
        "Selenium",
        "Playwright",
        "Cypress",
        "CI/CD",
        "TypeScript",
      ],
      experienceRequired: 5,
      isActive: true,
      sourceUserId: ADMIN_VENDOR,
    },
    {
      _id: BJ[21],
      vendorId: ADMIN_VENDOR,
      vendorEmail: "admin@vendor.com",
      recruiterName: "Admin Vendor",
      recruiterPhone: "555-100-0001",
      title: "GraphQL API Developer",
      description:
        "Design federated GraphQL layer with Apollo Federation. Node.js + TypeScript backend.",
      location: "Remote",
      jobCountry: "US",
      jobState: "",
      jobCity: "",
      jobType: "1099",
      jobSubType: "hourly",
      workMode: "remote",
      payPerHour: 80,
      skillsRequired: [
        "GraphQL",
        "Node.js",
        "TypeScript",
        "Apollo",
        "PostgreSQL",
      ],
      experienceRequired: 4,
      isActive: true,
      sourceUserId: ADMIN_VENDOR,
    },
    {
      _id: BJ[22],
      vendorId: ADMIN_VENDOR,
      vendorEmail: "admin@vendor.com",
      recruiterName: "Admin Vendor",
      recruiterPhone: "555-100-0001",
      title: "Video Streaming Engineer",
      description:
        "HLS/DASH transcoding pipelines. FFmpeg, WebRTC for live events.",
      location: "Los Angeles, CA",
      jobCountry: "US",
      jobState: "CA",
      jobCity: "Los Angeles",
      jobType: "w2",
      jobSubType: "salary",
      workMode: "onsite",
      salaryMin: 155000,
      salaryMax: 195000,
      skillsRequired: ["FFmpeg", "WebRTC", "HLS", "C++", "Python"],
      experienceRequired: 5,
      isActive: true,
      sourceUserId: ADMIN_VENDOR,
    },
    {
      _id: BJ[23],
      vendorId: ADMIN_VENDOR,
      vendorEmail: "admin@vendor.com",
      recruiterName: "Admin Vendor",
      recruiterPhone: "555-100-0001",
      title: "Terraform Cloud Engineer",
      description:
        "Multi-cloud IaC with Terraform Cloud workspaces. Drift detection and policy-as-code.",
      location: "Denver, CO",
      jobCountry: "US",
      jobState: "CO",
      jobCity: "Denver",
      jobType: "c2c",
      jobSubType: "contract",
      workMode: "remote",
      payPerHour: 100,
      skillsRequired: ["Terraform", "AWS", "Azure", "IaC", "Python"],
      experienceRequired: 5,
      isActive: true,
      sourceUserId: ADMIN_VENDOR,
    },
    {
      _id: BJ[24],
      vendorId: ADMIN_VENDOR,
      vendorEmail: "admin@vendor.com",
      recruiterName: "Admin Vendor",
      recruiterPhone: "555-100-0001",
      title: "Mobile Product Designer",
      description:
        "End-to-end mobile UX from research to high-fidelity Figma prototypes.",
      location: "New York, NY",
      jobCountry: "US",
      jobState: "NY",
      jobCity: "New York",
      jobType: "1099",
      jobSubType: "hourly",
      workMode: "hybrid",
      payPerHour: 70,
      skillsRequired: [
        "Figma",
        "Mobile Design",
        "Prototyping",
        "User Research",
        "Design Systems",
      ],
      experienceRequired: 3,
      isActive: true,
      sourceUserId: ADMIN_VENDOR,
    },
    {
      _id: BJ[25],
      vendorId: ADMIN_VENDOR,
      vendorEmail: "admin@vendor.com",
      recruiterName: "Admin Vendor",
      recruiterPhone: "555-100-0001",
      title: "Technical Writer / Developer Docs",
      description:
        "API documentation, tutorials, and SDKs. Markdown, code samples, and OpenAPI specs.",
      location: "Remote",
      jobCountry: "US",
      jobState: "",
      jobCity: "",
      jobType: "1099",
      jobSubType: "hourly",
      workMode: "remote",
      payPerHour: 55,
      skillsRequired: [
        "Technical Writing",
        "API Docs",
        "Markdown",
        "Developer Experience",
        "Git",
      ],
      experienceRequired: 2,
      isActive: true,
      sourceUserId: ADMIN_VENDOR,
    },
    {
      _id: BJ[26],
      vendorId: ADMIN_VENDOR,
      vendorEmail: "admin@vendor.com",
      recruiterName: "Admin Vendor",
      recruiterPhone: "555-100-0001",
      title: "ERP Implementation Lead",
      description:
        "End-to-end SAP/Oracle ERP implementation for a manufacturing client.",
      location: "Houston, TX",
      jobCountry: "US",
      jobState: "TX",
      jobCity: "Houston",
      jobType: "c2c",
      jobSubType: "contract",
      workMode: "onsite",
      payPerHour: 105,
      skillsRequired: [
        "SAP",
        "Oracle ERP",
        "Implementation",
        "Project Management",
        "SQL",
      ],
      experienceRequired: 8,
      isActive: true,
      sourceUserId: ADMIN_VENDOR,
    },
    {
      _id: BJ[27],
      vendorId: ADMIN_VENDOR,
      vendorEmail: "admin@vendor.com",
      recruiterName: "Admin Vendor",
      recruiterPhone: "555-100-0001",
      title: "Security Operations Lead",
      description:
        "Lead SOC team: SIEM, threat intelligence, incident response playbooks, and cloud security posture.",
      location: "Washington, DC",
      jobCountry: "US",
      jobState: "DC",
      jobCity: "Washington",
      jobType: "w2",
      jobSubType: "salary",
      workMode: "onsite",
      salaryMin: 150000,
      salaryMax: 190000,
      skillsRequired: [
        "SOC",
        "SIEM",
        "Incident Response",
        "Threat Intel",
        "Cloud Security",
      ],
      experienceRequired: 7,
      isActive: true,
      sourceUserId: ADMIN_VENDOR,
    },
    {
      _id: BJ[28],
      vendorId: ADMIN_VENDOR,
      vendorEmail: "admin@vendor.com",
      recruiterName: "Admin Vendor",
      recruiterPhone: "555-100-0001",
      title: "ETL / Data Integration Developer",
      description:
        "Python-based ETL with Airflow, Spark, and dbt. Snowflake data warehouse.",
      location: "Minneapolis, MN",
      jobCountry: "US",
      jobState: "MN",
      jobCity: "Minneapolis",
      jobType: "w2",
      jobSubType: "salary",
      workMode: "remote",
      salaryMin: 120000,
      salaryMax: 155000,
      skillsRequired: ["Python", "Airflow", "Spark", "dbt", "SQL"],
      experienceRequired: 4,
      isActive: true,
      sourceUserId: ADMIN_VENDOR,
    },
    {
      _id: BJ[29],
      vendorId: ADMIN_VENDOR,
      vendorEmail: "admin@vendor.com",
      recruiterName: "Admin Vendor",
      recruiterPhone: "555-100-0001",
      title: "Flutter Mobile Developer",
      description:
        "Cross-platform mobile app with Flutter & Dart. Firebase and REST integrations.",
      location: "Austin, TX",
      jobCountry: "US",
      jobState: "TX",
      jobCity: "Austin",
      jobType: "1099",
      jobSubType: "hourly",
      workMode: "remote",
      payPerHour: 72,
      skillsRequired: ["Flutter", "Dart", "Firebase", "REST APIs", "Mobile"],
      experienceRequired: 3,
      isActive: true,
      sourceUserId: ADMIN_VENDOR,
    },
  ]);
  console.log(`  ✓ Created ${bulkJobs.length} jobs`);

  /* Assign clientCompanyId to each job */
  await Job.bulkWrite(
    BJ.map((id, i) => ({
      updateOne: {
        filter: { _id: id },
        update: { $set: { clientCompanyId: jobClientCycle[i] } },
      },
    })),
  );
  console.log(`  ✓ Assigned client companies to ${BJ.length} jobs`);

  /* ================================================================ */
  /*  20 NEW CANDIDATE PROFILES                                        */
  /* ================================================================ */
  const profiles = await CandidateProfile.insertMany([
    {
      _id: oid(),
      candidateId: C11,
      username: "anika-patel-c00011",
      name: "Anika Patel",
      email: "anika.patel@test.com",
      phone: "555-011-0011",
      currentCompany: "FrontendCo",
      currentRole: "Senior Frontend Developer",
      preferredJobType: "w2",
      expectedHourlyRate: 78,
      experienceYears: 5,
      skills: ["React", "Vue.js", "TypeScript", "Next.js", "CSS", "GraphQL"],
      location: "New York, NY",
      profileCountry: "US",
      bio: "Senior frontend developer specializing in React and Vue.js SPA applications.",
      resumeSummary:
        "5 years building high-performance SPAs for fintech and e-commerce.",
      resumeExperience:
        "FrontendCo (2022–present): Senior FE — Vue 3 migration.\nWebStudio (2020–2022): React + Next.js for SaaS dashboards.",
      resumeEducation: "B.S. Computer Science, Cornell University, 2020",
      resumeAchievements: "Led Vue 3 migration reducing bundle size by 45%.",
      companyId: COMPANY_ID,
      companyName: COMPANY_NAME,
      profileLocked: false,
    },
    {
      _id: oid(),
      candidateId: C12,
      username: "marcus-thompson-c00012",
      name: "Marcus Thompson",
      email: "marcus.thompson@test.com",
      phone: "555-012-0012",
      currentCompany: "EnterpriseTech",
      currentRole: "Senior Java Developer",
      preferredJobType: "w2",
      expectedHourlyRate: 88,
      experienceYears: 7,
      skills: [
        "Java",
        "Spring Boot",
        "Kafka",
        "PostgreSQL",
        "Microservices",
        "Docker",
      ],
      location: "Dallas, TX",
      profileCountry: "US",
      bio: "Backend engineer building event-driven microservices with Java and Kafka.",
      resumeSummary:
        "7 years of enterprise Java development and distributed systems.",
      resumeExperience:
        "EnterpriseTech (2021–present): Senior Java Dev — Kafka event mesh.\nCorpSoft (2018–2021): Spring Boot services for banking platform.",
      resumeEducation: "M.S. Computer Science, Georgia Tech, 2018",
      resumeAchievements:
        "Designed event-sourcing architecture handling 100k events/sec.",
      companyId: COMPANY_ID,
      companyName: COMPANY_NAME,
      profileLocked: false,
    },
    {
      _id: oid(),
      candidateId: C13,
      username: "elena-volkov-c00013",
      name: "Elena Volkov",
      email: "elena.volkov@test.com",
      phone: "555-013-0013",
      currentCompany: "AI Research Lab",
      currentRole: "Data Scientist",
      preferredJobType: "w2",
      expectedHourlyRate: 82,
      experienceYears: 4,
      skills: ["Python", "TensorFlow", "PyTorch", "NLP", "Scikit-learn", "SQL"],
      location: "Seattle, WA",
      profileCountry: "US",
      bio: "Data scientist with ML expertise in NLP and computer vision.",
      resumeSummary:
        "4 years applied ML in production — NLP, classification, recommendation.",
      resumeExperience:
        "AI Research Lab (2023–present): ML models for document understanding.\nMLStartup (2021–2023): NLP pipeline for sentiment analysis.",
      resumeEducation: "M.S. Machine Learning, University of Washington, 2021",
      resumeAchievements:
        "Published 2 papers on transformer-based document classification.",
      companyId: COMPANY_ID,
      companyName: COMPANY_NAME,
      profileLocked: false,
    },
    {
      _id: oid(),
      candidateId: C14,
      username: "diego-torres-c00014",
      name: "Diego Torres",
      email: "diego.torres@test.com",
      phone: "555-014-0014",
      currentCompany: "CloudNative Inc.",
      currentRole: "Cloud Architect",
      preferredJobType: "c2c",
      expectedHourlyRate: 95,
      experienceYears: 6,
      skills: ["AWS", "GCP", "Terraform", "Kubernetes", "Docker", "Python"],
      location: "San Francisco, CA",
      profileCountry: "US",
      bio: "Multi-cloud architect with deep AWS and GCP expertise.",
      resumeSummary:
        "6 years designing scalable cloud infrastructure for high-traffic platforms.",
      resumeExperience:
        "CloudNative (2021–present): Architect — multi-region AWS/GCP.\nDevInfra (2019–2021): Cloud Engineer — Terraform for 200+ services.",
      resumeEducation: "B.S. Computer Engineering, Stanford University, 2019",
      resumeAchievements:
        "Reduced cloud costs by $1.2M/year through right-sizing and Reserved Instances.",
      companyId: COMPANY_ID,
      companyName: COMPANY_NAME,
      profileLocked: false,
    },
    {
      _id: oid(),
      candidateId: C15,
      username: "yuki-tanaka-c00015",
      name: "Yuki Tanaka",
      email: "yuki.tanaka@test.com",
      phone: "555-015-0015",
      currentCompany: "MobileFirst",
      currentRole: "Mobile Developer",
      preferredJobType: "1099",
      expectedHourlyRate: 75,
      experienceYears: 5,
      skills: [
        "Swift",
        "Kotlin",
        "Flutter",
        "React Native",
        "Firebase",
        "REST APIs",
      ],
      location: "Boston, MA",
      profileCountry: "US",
      bio: "Cross-platform mobile developer with native iOS and Android experience.",
      resumeSummary:
        "5 years building consumer and enterprise mobile apps on iOS and Android.",
      resumeExperience:
        "MobileFirst (2022–present): Flutter + native iOS modules.\nAppWorks (2020–2022): Kotlin Android app — 500k+ downloads.",
      resumeEducation: "B.S. Computer Science, MIT, 2020",
      resumeAchievements:
        "Shipped 4 apps to App Store / Play Store with 4.7+ avg rating.",
      companyId: COMPANY_ID,
      companyName: COMPANY_NAME,
      profileLocked: false,
    },
    {
      _id: oid(),
      candidateId: C16,
      username: "sarah-mitchell-c00016",
      name: "Sarah Mitchell",
      email: "sarah.mitchell@test.com",
      phone: "555-016-0016",
      currentCompany: "PyStack",
      currentRole: "Python Backend Developer",
      preferredJobType: "w2",
      expectedHourlyRate: 72,
      experienceYears: 4,
      skills: ["Python", "Django", "FastAPI", "PostgreSQL", "Redis", "Docker"],
      location: "Denver, CO",
      profileCountry: "US",
      bio: "Python backend developer building REST and GraphQL APIs.",
      resumeSummary:
        "4 years of Django/FastAPI backend development with strong testing culture.",
      resumeExperience:
        "PyStack (2022–present): FastAPI microservices + PostgreSQL.\nDevShop (2021–2022): Django REST APIs for e-commerce.",
      resumeEducation: "B.S. Software Engineering, CU Boulder, 2021",
      resumeAchievements:
        "Achieved 98% test coverage on core payment microservices.",
      companyId: COMPANY_ID,
      companyName: COMPANY_NAME,
      profileLocked: false,
    },
    {
      _id: oid(),
      candidateId: C17,
      username: "kwame-asante-c00017",
      name: "Kwame Asante",
      email: "kwame.asante@test.com",
      phone: "555-017-0017",
      currentCompany: "AzureSoft",
      currentRole: ".NET Backend Developer",
      preferredJobType: "w2",
      expectedHourlyRate: 85,
      experienceYears: 6,
      skills: [
        "C#",
        ".NET",
        "Azure",
        "SQL Server",
        "Microservices",
        "RabbitMQ",
      ],
      location: "Atlanta, GA",
      profileCountry: "US",
      bio: ".NET platform engineer building enterprise microservices on Azure.",
      resumeSummary:
        "6 years of C#/.NET development with Azure cloud-native architecture.",
      resumeExperience:
        "AzureSoft (2021–present): .NET 8 microservices on AKS.\nCorpDev (2019–2021): WPF desktop → .NET web migration.",
      resumeEducation: "B.S. Computer Science, Georgia State University, 2019",
      resumeAchievements:
        "Migrated monolith to 12 microservices with zero downtime.",
      companyId: COMPANY_ID,
      companyName: COMPANY_NAME,
      profileLocked: false,
    },
    {
      _id: oid(),
      candidateId: C18,
      username: "mei-lin-c00018",
      name: "Mei Lin",
      email: "mei.lin@test.com",
      phone: "555-018-0018",
      currentCompany: "AngularPro",
      currentRole: "Angular Developer",
      preferredJobType: "w2",
      expectedHourlyRate: 76,
      experienceYears: 5,
      skills: ["Angular", "TypeScript", "RxJS", "NgRx", "CSS", "Node.js"],
      location: "Chicago, IL",
      profileCountry: "US",
      bio: "Angular specialist building complex enterprise dashboards.",
      resumeSummary:
        "5 years of Angular development for enterprise B2B applications.",
      resumeExperience:
        "AngularPro (2022–present): Angular 17 dashboard with NgRx.\nUITeam (2020–2022): Angular migration from AngularJS.",
      resumeEducation: "M.S. Computer Science, Northwestern University, 2020",
      resumeAchievements:
        "Led successful AngularJS to Angular 15 migration for 40+ screens.",
      companyId: COMPANY_ID,
      companyName: COMPANY_NAME,
      profileLocked: false,
    },
    {
      _id: oid(),
      candidateId: C19,
      username: "rafael-costa-c00019",
      name: "Rafael Costa",
      email: "rafael.costa@test.com",
      phone: "555-019-0019",
      currentCompany: "DataPipeline Co",
      currentRole: "Data Engineer",
      preferredJobType: "w2",
      expectedHourlyRate: 80,
      experienceYears: 4,
      skills: ["Python", "Apache Spark", "Airflow", "Snowflake", "dbt", "SQL"],
      location: "Portland, OR",
      profileCountry: "US",
      bio: "Data engineer building modern data stacks with Snowflake and dbt.",
      resumeSummary:
        "4 years building data pipelines and lakehouse architectures.",
      resumeExperience:
        "DataPipeline (2022–present): Snowflake + dbt transformations.\nETLWorks (2021–2022): Spark pipelines on AWS EMR.",
      resumeEducation: "B.S. Data Science, Oregon State University, 2021",
      resumeAchievements:
        "Built dbt framework reducing analyst query time by 60%.",
      companyId: COMPANY_ID,
      companyName: COMPANY_NAME,
      profileLocked: false,
    },
    {
      _id: oid(),
      candidateId: C20,
      username: "fatima-alrashid-c00020",
      name: "Fatima Al-Rashid",
      email: "fatima.alrashid@test.com",
      phone: "555-020-0020",
      currentCompany: "CyberGuard",
      currentRole: "Senior Security Engineer",
      preferredJobType: "w2",
      expectedHourlyRate: 92,
      experienceYears: 7,
      skills: [
        "SIEM",
        "Pen Testing",
        "SOC",
        "Incident Response",
        "Cloud Security",
        "Python",
      ],
      location: "Washington, DC",
      profileCountry: "US",
      bio: "Cybersecurity professional leading SOC operations and threat hunting.",
      resumeSummary:
        "7 years in security: SOC operations, penetration testing, and cloud security.",
      resumeExperience:
        "CyberGuard (2021–present): Security Lead — managed SOC for 1000+ endpoints.\nSecOps (2018–2021): Penetration Tester — OWASP Top 10.",
      resumeEducation: "M.S. Cybersecurity, George Washington University, 2018",
      resumeAchievements:
        "CISSP, OSCP certified. Zero breaches in 3 years of SOC leadership.",
      companyId: COMPANY_ID,
      companyName: COMPANY_NAME,
      profileLocked: false,
    },
    {
      _id: oid(),
      candidateId: C21,
      username: "patrick-obrien-c00021",
      name: "Patrick O'Brien",
      email: "patrick.obrien@test.com",
      phone: "555-021-0021",
      currentCompany: "SystemsForge",
      currentRole: "Staff Systems Engineer",
      preferredJobType: "c2c",
      expectedHourlyRate: 98,
      experienceYears: 8,
      skills: ["Go", "Rust", "gRPC", "Linux", "Distributed Systems", "C"],
      location: "Seattle, WA",
      profileCountry: "US",
      bio: "Systems engineer building high-performance backend services in Go and Rust.",
      resumeSummary:
        "8 years of systems and infrastructure programming for low-latency workloads.",
      resumeExperience:
        "SystemsForge (2020–present): Rust networking stack — 1M concurrent conns.\nBackendLab (2017–2020): Go microservices for trading platform.",
      resumeEducation:
        "M.S. Computer Science, Carnegie Mellon University, 2017",
      resumeAchievements:
        "Built zero-copy network stack reducing latency by 85%.",
      companyId: COMPANY_ID,
      companyName: COMPANY_NAME,
      profileLocked: false,
    },
    {
      _id: oid(),
      candidateId: C22,
      username: "ingrid-larsson-c00022",
      name: "Ingrid Larsson",
      email: "ingrid.larsson@test.com",
      phone: "555-022-0022",
      currentCompany: "QualityFirst",
      currentRole: "QA Architect",
      preferredJobType: "w2",
      expectedHourlyRate: 68,
      experienceYears: 5,
      skills: [
        "Selenium",
        "Playwright",
        "Cypress",
        "Jest",
        "CI/CD",
        "TypeScript",
      ],
      location: "Minneapolis, MN",
      profileCountry: "US",
      bio: "QA architect designing test automation frameworks for enterprise apps.",
      resumeSummary:
        "5 years leading QA automation across web, mobile, and API layers.",
      resumeExperience:
        "QualityFirst (2022–present): QA Architect — Playwright + Cypress.\nTestTeam (2020–2022): Selenium Grid for 3 product teams.",
      resumeEducation:
        "B.S. Software Engineering, University of Minnesota, 2020",
      resumeAchievements:
        "Reduced regression suite from 6 hours to 30 minutes with parallel execution.",
      companyId: COMPANY_ID,
      companyName: COMPANY_NAME,
      profileLocked: false,
    },
    {
      _id: oid(),
      candidateId: C23,
      username: "vikram-khanna-c00023",
      name: "Vikram Khanna",
      email: "vikram.khanna@test.com",
      phone: "555-023-0023",
      currentCompany: "Web3Labs",
      currentRole: "Blockchain Developer",
      preferredJobType: "1099",
      expectedHourlyRate: 90,
      experienceYears: 3,
      skills: [
        "Solidity",
        "Web3.js",
        "Ethereum",
        "Node.js",
        "GraphQL",
        "TypeScript",
      ],
      location: "New York, NY",
      profileCountry: "US",
      bio: "Web3 developer building smart contracts and DeFi protocols.",
      resumeSummary:
        "3 years in blockchain: smart contracts, DeFi, and dApp development.",
      resumeExperience:
        "Web3Labs (2023–present): Solidity smart contracts for DEX.\nCryptoStudio (2022–2023): Web3.js integration for NFT marketplace.",
      resumeEducation: "B.S. Computer Science, NYU, 2022",
      resumeAchievements: "Audited smart contracts securing $50M+ in TVL.",
      companyId: COMPANY_ID,
      companyName: COMPANY_NAME,
      profileLocked: false,
    },
    {
      _id: oid(),
      candidateId: C24,
      username: "natasha-williams-c00024",
      name: "Natasha Williams",
      email: "natasha.williams@test.com",
      phone: "555-024-0024",
      currentCompany: "AgileWorks",
      currentRole: "Technical Product Manager",
      preferredJobType: "w2",
      expectedHourlyRate: 85,
      experienceYears: 6,
      skills: [
        "Product Management",
        "Agile",
        "Scrum",
        "JIRA",
        "SQL",
        "Data Analysis",
      ],
      location: "San Jose, CA",
      profileCountry: "US",
      bio: "Technical PM bridging business and engineering for developer tools.",
      resumeSummary:
        "6 years leading product teams for B2B SaaS and developer platforms.",
      resumeExperience:
        "AgileWorks (2021–present): PM — developer productivity platform.\nProdTech (2019–2021): Associate PM — CI/CD pipeline product.",
      resumeEducation: "MBA, UC Berkeley Haas, 2019",
      resumeAchievements:
        "Grew DAU by 300% through developer-focused product improvements.",
      companyId: COMPANY_ID,
      companyName: COMPANY_NAME,
      profileLocked: false,
    },
    {
      _id: oid(),
      candidateId: C25,
      username: "chen-wei-c00025",
      name: "Chen Wei",
      email: "chen.wei@test.com",
      phone: "555-025-0025",
      currentCompany: "NLPTech",
      currentRole: "AI/NLP Engineer",
      preferredJobType: "w2",
      expectedHourlyRate: 95,
      experienceYears: 5,
      skills: [
        "Python",
        "NLP",
        "Transformers",
        "PyTorch",
        "LangChain",
        "HuggingFace",
      ],
      location: "Cambridge, MA",
      profileCountry: "US",
      bio: "NLP engineer building production LLM pipelines and RAG systems.",
      resumeSummary:
        "5 years of NLP: from classical NLP to modern LLM-powered applications.",
      resumeExperience:
        "NLPTech (2022–present): LLM fine-tuning and RAG pipeline.\nLangAI (2020–2022): NER and sentiment analysis at scale.",
      resumeEducation: "Ph.D. Computer Science (NLP), MIT, 2020",
      resumeAchievements:
        "Patent on efficient retrieval-augmented generation method.",
      companyId: COMPANY_ID,
      companyName: COMPANY_NAME,
      profileLocked: false,
    },
    {
      _id: oid(),
      candidateId: C26,
      username: "isabella-santos-c00026",
      name: "Isabella Santos",
      email: "isabella.santos@test.com",
      phone: "555-026-0026",
      currentCompany: "DesignStudio",
      currentRole: "UX Designer",
      preferredJobType: "1099",
      expectedHourlyRate: 65,
      experienceYears: 4,
      skills: [
        "Figma",
        "UI Design",
        "UX Research",
        "Prototyping",
        "Design Systems",
        "HTML",
      ],
      location: "Miami, FL",
      profileCountry: "US",
      bio: "UX designer creating intuitive mobile and web experiences.",
      resumeSummary:
        "4 years designing user-centered products for consumer and enterprise.",
      resumeExperience:
        "DesignStudio (2022–present): Lead Designer — mobile banking app.\nUXAgency (2021–2022): UX Designer — e-commerce redesign.",
      resumeEducation: "BFA Graphic Design, Parsons School of Design, 2021",
      resumeAchievements: "Redesign increased mobile conversion rate by 35%.",
      companyId: COMPANY_ID,
      companyName: COMPANY_NAME,
      profileLocked: false,
    },
    {
      _id: oid(),
      candidateId: C27,
      username: "alexei-petrov-c00027",
      name: "Alexei Petrov",
      email: "alexei.petrov@test.com",
      phone: "555-027-0027",
      currentCompany: "EmbedTech",
      currentRole: "Embedded Systems Engineer",
      preferredJobType: "w2",
      expectedHourlyRate: 88,
      experienceYears: 6,
      skills: ["C", "C++", "RTOS", "BLE", "Embedded Systems", "ARM"],
      location: "Austin, TX",
      profileCountry: "US",
      bio: "Embedded engineer building firmware for IoT and medical devices.",
      resumeSummary:
        "6 years of firmware development for resource-constrained devices.",
      resumeExperience:
        "EmbedTech (2021–present): Firmware Lead — BLE wearable device.\nIoTCorp (2019–2021): Embedded C for industrial sensors.",
      resumeEducation: "M.S. Electrical Engineering, UT Austin, 2019",
      resumeAchievements:
        "Reduced BLE connection time from 3s to 200ms through protocol optimization.",
      companyId: COMPANY_ID,
      companyName: COMPANY_NAME,
      profileLocked: false,
    },
    {
      _id: oid(),
      candidateId: C28,
      username: "amara-okafor-c00028",
      name: "Amara Okafor",
      email: "amara.okafor@test.com",
      phone: "555-028-0028",
      currentCompany: "CRMPlatform",
      currentRole: "Salesforce Developer",
      preferredJobType: "c2c",
      expectedHourlyRate: 78,
      experienceYears: 4,
      skills: [
        "Salesforce",
        "Apex",
        "Lightning",
        "SOQL",
        "Integration",
        "JavaScript",
      ],
      location: "Tampa, FL",
      profileCountry: "US",
      bio: "Salesforce developer building custom CRM solutions and integrations.",
      resumeSummary:
        "4 years of Salesforce development: CPQ, Lightning, and API integrations.",
      resumeExperience:
        "CRMPlatform (2022–present): Salesforce CPQ implementation.\nSFConsulting (2021–2022): Lightning components for financial services.",
      resumeEducation: "B.S. Information Systems, USF, 2021",
      resumeAchievements:
        "Salesforce Certified Platform Developer II. Built CPQ reducing quote time by 50%.",
      companyId: COMPANY_ID,
      companyName: COMPANY_NAME,
      profileLocked: false,
    },
    {
      _id: oid(),
      candidateId: C29,
      username: "jordan-kim-c00029",
      name: "Jordan Kim",
      email: "jordan.kim@test.com",
      phone: "555-029-0029",
      currentCompany: "PlatformOps",
      currentRole: "Platform / SRE Engineer",
      preferredJobType: "c2c",
      expectedHourlyRate: 90,
      experienceYears: 5,
      skills: ["Kubernetes", "Prometheus", "Grafana", "Terraform", "AWS", "Go"],
      location: "San Jose, CA",
      profileCountry: "US",
      bio: "SRE / Platform engineer focused on container orchestration and observability.",
      resumeSummary:
        "5 years running production Kubernetes and building internal developer platforms.",
      resumeExperience:
        "PlatformOps (2022–present): K8s platform for 50+ services.\nReliabilityEng (2020–2022): SRE — Prometheus/Grafana observability stack.",
      resumeEducation: "B.S. Computer Science, UC San Diego, 2020",
      resumeAchievements:
        "Built self-service platform reducing deploy time from 2 hours to 10 minutes.",
      companyId: COMPANY_ID,
      companyName: COMPANY_NAME,
      profileLocked: false,
    },
    {
      _id: oid(),
      candidateId: C30,
      username: "leila-hashemi-c00030",
      name: "Leila Hashemi",
      email: "leila.hashemi@test.com",
      phone: "555-030-0030",
      currentCompany: "DBExperts",
      currentRole: "Senior Database Administrator",
      preferredJobType: "w2",
      expectedHourlyRate: 82,
      experienceYears: 6,
      skills: [
        "PostgreSQL",
        "MongoDB",
        "Oracle",
        "Performance Tuning",
        "Replication",
        "SQL",
      ],
      location: "Richmond, VA",
      profileCountry: "US",
      bio: "DBA managing production databases for high-transaction systems.",
      resumeSummary:
        "6 years administering PostgreSQL, MongoDB, and Oracle in production environments.",
      resumeExperience:
        "DBExperts (2021–present): DBA Lead — PostgreSQL HA cluster.\nDataOps (2019–2021): MongoDB sharded cluster management.",
      resumeEducation: "B.S. Computer Science, Virginia Tech, 2019",
      resumeAchievements:
        "Designed HA setup achieving 99.999% uptime for financial transaction DB.",
      companyId: COMPANY_ID,
      companyName: COMPANY_NAME,
      profileLocked: false,
    },
  ]);
  console.log(`  ✓ Created ${profiles.length} candidate profiles`);

  /* ================================================================ */
  /*  APPLICATIONS — new candidates apply to new & existing jobs       */
  /* ================================================================ */

  // Existing job IDs from the base seed — we query them
  const existingJobs = await Job.find({}, { _id: 1 }).lean();
  const existingJobIds = existingJobs.map((j) => j._id as string);
  // Base seed created J[0..19]; we reference some of them by title lookup
  const findJob = async (title: string) => {
    const j = await Job.findOne(
      { title: { $regex: title, $options: "i" } },
      { _id: 1 },
    ).lean();
    return j?._id as string | undefined;
  };

  const J_REACT = await findJob("Senior React Developer");
  const J_ANGULAR = await findJob("Angular Frontend Developer");
  const J_DEVOPS = await findJob("DevOps / Cloud Engineer");
  const J_IOS = await findJob("iOS Mobile Developer");
  const J_ML = await findJob("Machine Learning Engineer");
  const J_CYBER = await findJob("Cybersecurity Analyst");
  const J_UIUX = await findJob("UI/UX Designer");
  const J_DATA_ENG = await findJob("Python Data Engineer");
  const J_QA = await findJob("QA Automation Lead");
  const J_JAVA = await findJob("Java Backend Developer");
  const J_GO = await findJob("Staff Backend Engineer");
  const J_EMBEDDED = await findJob("Embedded Systems Engineer");
  const J_SRE = await findJob("Site Reliability Engineer");
  const J_TPM = await findJob("Technical Product Manager");
  const J_BLOCKCHAIN = await findJob("Blockchain Developer");
  const J_SF = await findJob("Salesforce Developer");

  const BA = Array.from({ length: 50 }, () => oid());

  type AppRow = {
    idx: number;
    jobId: string;
    jobTitle: string;
    cId: string;
    cEmail: string;
    cover: string;
    status: string;
  };
  const appRows: AppRow[] = [
    // ── C11 Anika (Frontend) ──
    {
      idx: 0,
      jobId: BJ[0],
      jobTitle: "Senior Vue.js Developer",
      cId: C11,
      cEmail: "anika.patel@test.com",
      cover: "Vue.js is my primary framework — 3 years of Vue 3 + Pinia.",
      status: "accepted",
    },
    ...(J_REACT
      ? [
          {
            idx: 1,
            jobId: J_REACT,
            jobTitle: "Senior React Developer",
            cId: C11,
            cEmail: "anika.patel@test.com",
            cover: "React + TypeScript is my core skill set.",
            status: "reviewed",
          },
        ]
      : []),
    // ── C12 Marcus (Java) ──
    {
      idx: 2,
      jobId: BJ[4],
      jobTitle: "Senior Java Microservices Developer",
      cId: C12,
      cEmail: "marcus.thompson@test.com",
      cover: "Java + Spring Boot + Kafka — this is exactly my stack.",
      status: "accepted",
    },
    ...(J_JAVA
      ? [
          {
            idx: 3,
            jobId: J_JAVA,
            jobTitle: "Java Backend Developer",
            cId: C12,
            cEmail: "marcus.thompson@test.com",
            cover: "7 years of Java enterprise development.",
            status: "pending",
          },
        ]
      : []),
    // ── C13 Elena (ML/DS) ──
    {
      idx: 4,
      jobId: BJ[6],
      jobTitle: "AI / LLM Engineer",
      cId: C13,
      cEmail: "elena.volkov@test.com",
      cover: "ML + NLP with production LLM experience.",
      status: "accepted",
    },
    {
      idx: 5,
      jobId: BJ[16],
      jobTitle: "NLP Research Engineer",
      cId: C13,
      cEmail: "elena.volkov@test.com",
      cover: "Published researcher in transformer-based NLP.",
      status: "pending",
    },
    // ── C14 Diego (Cloud) ──
    {
      idx: 6,
      jobId: BJ[2],
      jobTitle: "Platform Engineer",
      cId: C14,
      cEmail: "diego.torres@test.com",
      cover: "Multi-cloud platform architecture is my specialty.",
      status: "accepted",
    },
    {
      idx: 7,
      jobId: BJ[5],
      jobTitle: "Kubernetes Platform Lead",
      cId: C14,
      cEmail: "diego.torres@test.com",
      cover: "K8s + ArgoCD — managed clusters for 100+ engineers.",
      status: "reviewed",
    },
    ...(J_DEVOPS
      ? [
          {
            idx: 8,
            jobId: J_DEVOPS,
            jobTitle: "DevOps / Cloud Engineer",
            cId: C14,
            cEmail: "diego.torres@test.com",
            cover: "AWS + Terraform + K8s — strong DevOps.",
            status: "reviewed",
          },
        ]
      : []),
    // ── C15 Yuki (Mobile) ──
    {
      idx: 9,
      jobId: BJ[3],
      jobTitle: "Android Mobile Developer",
      cId: C15,
      cEmail: "yuki.tanaka@test.com",
      cover: "Kotlin & Jetpack Compose native Android.",
      status: "accepted",
    },
    {
      idx: 10,
      jobId: BJ[9],
      jobTitle: "React Native Team Lead",
      cId: C15,
      cEmail: "yuki.tanaka@test.com",
      cover: "Cross-platform with React Native + TypeScript.",
      status: "pending",
    },
    {
      idx: 11,
      jobId: BJ[29],
      jobTitle: "Flutter Mobile Developer",
      cId: C15,
      cEmail: "yuki.tanaka@test.com",
      cover: "Flutter is in my toolkit alongside native.",
      status: "reviewed",
    },
    ...(J_IOS
      ? [
          {
            idx: 12,
            jobId: J_IOS,
            jobTitle: "iOS Mobile Developer",
            cId: C15,
            cEmail: "yuki.tanaka@test.com",
            cover: "Swift + SwiftUI native iOS experience.",
            status: "accepted",
          },
        ]
      : []),
    // ── C16 Sarah (Python BE) ──
    {
      idx: 13,
      jobId: BJ[1],
      jobTitle: "Backend Python Engineer",
      cId: C16,
      cEmail: "sarah.mitchell@test.com",
      cover: "Django + FastAPI — 4 years Python backend.",
      status: "accepted",
    },
    {
      idx: 14,
      jobId: BJ[19],
      jobTitle: "Ruby on Rails Developer",
      cId: C16,
      cEmail: "sarah.mitchell@test.com",
      cover: "Familiar with Rails + PostgreSQL stack.",
      status: "pending",
    },
    // ── C17 Kwame (.NET) ──
    {
      idx: 15,
      jobId: BJ[10],
      jobTitle: ".NET Backend Developer",
      cId: C17,
      cEmail: "kwame.asante@test.com",
      cover: "C# + .NET 8 + Azure — exactly my stack.",
      status: "accepted",
    },
    // ── C18 Mei (Angular) ──
    {
      idx: 16,
      jobId: BJ[0],
      jobTitle: "Senior Vue.js Developer",
      cId: C18,
      cEmail: "mei.lin@test.com",
      cover: "Angular background, learning Vue — strong TypeScript.",
      status: "reviewed",
    },
    ...(J_ANGULAR
      ? [
          {
            idx: 17,
            jobId: J_ANGULAR,
            jobTitle: "Angular Frontend Developer",
            cId: C18,
            cEmail: "mei.lin@test.com",
            cover: "Angular 17 + NgRx is my core expertise.",
            status: "accepted",
          },
        ]
      : []),
    // ── C19 Rafael (Data Eng) ──
    {
      idx: 18,
      jobId: BJ[8],
      jobTitle: "Data Platform Architect",
      cId: C19,
      cEmail: "rafael.costa@test.com",
      cover: "Snowflake + dbt + Airflow is my daily stack.",
      status: "accepted",
    },
    {
      idx: 19,
      jobId: BJ[28],
      jobTitle: "ETL / Data Integration Developer",
      cId: C19,
      cEmail: "rafael.costa@test.com",
      cover: "Python ETL with Spark and dbt.",
      status: "pending",
    },
    ...(J_DATA_ENG
      ? [
          {
            idx: 20,
            jobId: J_DATA_ENG,
            jobTitle: "Python Data Engineer",
            cId: C19,
            cEmail: "rafael.costa@test.com",
            cover: "Spark + Airflow is my core.",
            status: "reviewed",
          },
        ]
      : []),
    // ── C20 Fatima (Security) ──
    {
      idx: 21,
      jobId: BJ[27],
      jobTitle: "Security Operations Lead",
      cId: C20,
      cEmail: "fatima.alrashid@test.com",
      cover: "SOC leadership with SIEM and incident response.",
      status: "accepted",
    },
    {
      idx: 22,
      jobId: BJ[12],
      jobTitle: "AWS Solutions Architect",
      cId: C20,
      cEmail: "fatima.alrashid@test.com",
      cover: "Cloud security + AWS architecture.",
      status: "reviewed",
    },
    ...(J_CYBER
      ? [
          {
            idx: 23,
            jobId: J_CYBER,
            jobTitle: "Cybersecurity Analyst",
            cId: C20,
            cEmail: "fatima.alrashid@test.com",
            cover: "CISSP + OSCP certified security engineer.",
            status: "pending",
          },
        ]
      : []),
    // ── C21 Patrick (Go/Rust) ──
    {
      idx: 24,
      jobId: BJ[7],
      jobTitle: "Rust Systems Programmer",
      cId: C21,
      cEmail: "patrick.obrien@test.com",
      cover: "Rust networking + systems — 3 years production Rust.",
      status: "accepted",
    },
    {
      idx: 25,
      jobId: BJ[2],
      jobTitle: "Platform Engineer",
      cId: C21,
      cEmail: "patrick.obrien@test.com",
      cover: "Go + K8s platform engineering experience.",
      status: "reviewed",
    },
    ...(J_GO
      ? [
          {
            idx: 26,
            jobId: J_GO,
            jobTitle: "Staff Backend Engineer (Go)",
            cId: C21,
            cEmail: "patrick.obrien@test.com",
            cover: "Go + gRPC distributed systems.",
            status: "reviewed",
          },
        ]
      : []),
    // ── C22 Ingrid (QA) ──
    {
      idx: 27,
      jobId: BJ[20],
      jobTitle: "QA Automation Architect",
      cId: C22,
      cEmail: "ingrid.larsson@test.com",
      cover: "QA architecture with Playwright + Cypress.",
      status: "accepted",
    },
    ...(J_QA
      ? [
          {
            idx: 28,
            jobId: J_QA,
            jobTitle: "QA Automation Lead",
            cId: C22,
            cEmail: "ingrid.larsson@test.com",
            cover: "Selenium + Playwright — 5 years QA automation.",
            status: "pending",
          },
        ]
      : []),
    // ── C23 Vikram (Blockchain/Web3) ──
    {
      idx: 29,
      jobId: BJ[21],
      jobTitle: "GraphQL API Developer",
      cId: C23,
      cEmail: "vikram.khanna@test.com",
      cover: "Node.js + GraphQL + TypeScript backend.",
      status: "accepted",
    },
    ...(J_BLOCKCHAIN
      ? [
          {
            idx: 30,
            jobId: J_BLOCKCHAIN,
            jobTitle: "Blockchain Developer",
            cId: C23,
            cEmail: "vikram.khanna@test.com",
            cover: "Solidity + Web3.js — DeFi protocols.",
            status: "pending",
          },
        ]
      : []),
    // ── C24 Natasha (PM) ──
    {
      idx: 31,
      jobId: BJ[13],
      jobTitle: "Scrum Master / Agile Coach",
      cId: C24,
      cEmail: "natasha.williams@test.com",
      cover: "6 years Agile/Scrum leadership.",
      status: "accepted",
    },
    ...(J_TPM
      ? [
          {
            idx: 32,
            jobId: J_TPM,
            jobTitle: "Technical Product Manager",
            cId: C24,
            cEmail: "natasha.williams@test.com",
            cover: "Technical PM with engineering background.",
            status: "pending",
          },
        ]
      : []),
    // ── C25 Chen (AI/NLP) ──
    {
      idx: 33,
      jobId: BJ[16],
      jobTitle: "NLP Research Engineer",
      cId: C25,
      cEmail: "chen.wei@test.com",
      cover: "Ph.D. in NLP — transformer fine-tuning and RAG.",
      status: "accepted",
    },
    {
      idx: 34,
      jobId: BJ[6],
      jobTitle: "AI / LLM Engineer",
      cId: C25,
      cEmail: "chen.wei@test.com",
      cover: "LLM pipeline architecture with LangChain.",
      status: "reviewed",
    },
    ...(J_ML
      ? [
          {
            idx: 35,
            jobId: J_ML,
            jobTitle: "Machine Learning Engineer",
            cId: C25,
            cEmail: "chen.wei@test.com",
            cover: "PyTorch + MLOps production models.",
            status: "pending",
          },
        ]
      : []),
    // ── C26 Isabella (UX) ──
    {
      idx: 36,
      jobId: BJ[24],
      jobTitle: "Mobile Product Designer",
      cId: C26,
      cEmail: "isabella.santos@test.com",
      cover: "Mobile UX + Figma prototyping.",
      status: "accepted",
    },
    {
      idx: 37,
      jobId: BJ[25],
      jobTitle: "Technical Writer / Developer Docs",
      cId: C26,
      cEmail: "isabella.santos@test.com",
      cover: "Design + documentation skills overlap.",
      status: "pending",
    },
    ...(J_UIUX
      ? [
          {
            idx: 38,
            jobId: J_UIUX,
            jobTitle: "UI/UX Designer (Contract)",
            cId: C26,
            cEmail: "isabella.santos@test.com",
            cover: "Figma + design systems — 4 years experience.",
            status: "reviewed",
          },
        ]
      : []),
    // ── C27 Alexei (Embedded) ──
    {
      idx: 39,
      jobId: BJ[17],
      jobTitle: "IoT Firmware Developer",
      cId: C27,
      cEmail: "alexei.petrov@test.com",
      cover: "BLE firmware for medical IoT — exactly my background.",
      status: "accepted",
    },
    {
      idx: 40,
      jobId: BJ[7],
      jobTitle: "Rust Systems Programmer",
      cId: C27,
      cEmail: "alexei.petrov@test.com",
      cover: "C/C++ systems with growing Rust experience.",
      status: "reviewed",
    },
    ...(J_EMBEDDED
      ? [
          {
            idx: 41,
            jobId: J_EMBEDDED,
            jobTitle: "Embedded Systems Engineer",
            cId: C27,
            cEmail: "alexei.petrov@test.com",
            cover: "C/C++ + RTOS + ARM — 6 years embedded.",
            status: "accepted",
          },
        ]
      : []),
    // ── C28 Amara (Salesforce) ──
    {
      idx: 42,
      jobId: BJ[15],
      jobTitle: "Salesforce Developer",
      cId: C28,
      cEmail: "amara.okafor@test.com",
      cover: "Certified SF Platform Dev II — CPQ implementation.",
      status: "accepted",
    },
    {
      idx: 43,
      jobId: BJ[18],
      jobTitle: "SAP ABAP Consultant",
      cId: C28,
      cEmail: "amara.okafor@test.com",
      cover: "CRM integration experience with SAP.",
      status: "pending",
    },
    ...(J_SF
      ? [
          {
            idx: 44,
            jobId: J_SF,
            jobTitle: "Salesforce Developer",
            cId: C28,
            cEmail: "amara.okafor@test.com",
            cover: "Apex + Lightning — 4 years Salesforce.",
            status: "reviewed",
          },
        ]
      : []),
    // ── C29 Jordan (SRE/Platform) ──
    {
      idx: 45,
      jobId: BJ[5],
      jobTitle: "Kubernetes Platform Lead",
      cId: C29,
      cEmail: "jordan.kim@test.com",
      cover: "K8s platform + ArgoCD GitOps.",
      status: "accepted",
    },
    {
      idx: 46,
      jobId: BJ[23],
      jobTitle: "Terraform Cloud Engineer",
      cId: C29,
      cEmail: "jordan.kim@test.com",
      cover: "Terraform Cloud + multi-cloud IaC.",
      status: "reviewed",
    },
    ...(J_SRE
      ? [
          {
            idx: 47,
            jobId: J_SRE,
            jobTitle: "Site Reliability Engineer",
            cId: C29,
            cEmail: "jordan.kim@test.com",
            cover: "Prometheus + Grafana + K8s — SRE.",
            status: "reviewed",
          },
        ]
      : []),
    // ── C30 Leila (DBA) ──
    {
      idx: 48,
      jobId: BJ[14],
      jobTitle: "PostgreSQL Database Administrator",
      cId: C30,
      cEmail: "leila.hashemi@test.com",
      cover: "PostgreSQL HA + replication specialist.",
      status: "accepted",
    },
    {
      idx: 49,
      jobId: BJ[8],
      jobTitle: "Data Platform Architect",
      cId: C30,
      cEmail: "leila.hashemi@test.com",
      cover: "Database architecture for data platforms.",
      status: "pending",
    },
  ];

  const applications = await Application.insertMany(
    appRows.map((r) => ({
      _id: BA[r.idx],
      jobId: r.jobId,
      jobTitle: r.jobTitle,
      candidateId: r.cId,
      candidateEmail: r.cEmail,
      coverLetter: r.cover,
      status: r.status,
    })),
  );
  console.log(`  ✓ Created ${applications.length} applications`);

  // Update application counts on affected jobs
  const appCounts: Record<string, number> = {};
  for (const a of applications)
    appCounts[a.jobId] = (appCounts[a.jobId] ?? 0) + 1;
  await Promise.all(
    Object.entries(appCounts).map(([jid, count]) =>
      Job.updateOne({ _id: jid }, { $inc: { applicationCount: count } }),
    ),
  );

  /* ================================================================ */
  /*  MARKETER-CANDIDATE links — all 20 new candidates join Alpha      */
  /* ================================================================ */
  const mcData: [string, string, string][] = [
    [C11, "Anika Patel", "anika.patel@test.com"],
    [C12, "Marcus Thompson", "marcus.thompson@test.com"],
    [C13, "Elena Volkov", "elena.volkov@test.com"],
    [C14, "Diego Torres", "diego.torres@test.com"],
    [C15, "Yuki Tanaka", "yuki.tanaka@test.com"],
    [C16, "Sarah Mitchell", "sarah.mitchell@test.com"],
    [C17, "Kwame Asante", "kwame.asante@test.com"],
    [C18, "Mei Lin", "mei.lin@test.com"],
    [C19, "Rafael Costa", "rafael.costa@test.com"],
    [C20, "Fatima Al-Rashid", "fatima.alrashid@test.com"],
    [C21, "Patrick O'Brien", "patrick.obrien@test.com"],
    [C22, "Ingrid Larsson", "ingrid.larsson@test.com"],
    [C23, "Vikram Khanna", "vikram.khanna@test.com"],
    [C24, "Natasha Williams", "natasha.williams@test.com"],
    [C25, "Chen Wei", "chen.wei@test.com"],
    [C26, "Isabella Santos", "isabella.santos@test.com"],
    [C27, "Alexei Petrov", "alexei.petrov@test.com"],
    [C28, "Amara Okafor", "amara.okafor@test.com"],
    [C29, "Jordan Kim", "jordan.kim@test.com"],
    [C30, "Leila Hashemi", "leila.hashemi@test.com"],
  ];

  const mcRecords = await MarketerCandidate.insertMany(
    mcData.map(([cid, name, email]) => ({
      _id: oid(),
      companyId: COMPANY_ID,
      marketerId: ADMIN_MARKETER,
      candidateId: cid,
      candidateName: name,
      candidateEmail: email,
      inviteStatus: "accepted",
    })),
  );
  console.log(`  ✓ Created ${mcRecords.length} marketer-candidate records`);

  /* ================================================================ */
  /*  FORWARDED OPENINGS — marketer forwards jobs to new candidates    */
  /* ================================================================ */
  const fwdData: {
    email: string;
    name: string;
    jobId: string;
    title: string;
    loc: string;
    type: string;
    sub: string;
    vendor: string;
    skills: string[];
    pay?: number;
    salMin?: number;
    salMax?: number;
    note: string;
    status: string;
  }[] = [
    {
      email: "anika.patel@test.com",
      name: "Anika Patel",
      jobId: BJ[0],
      title: "Senior Vue.js Developer",
      loc: "Remote",
      type: "w2",
      sub: "salary",
      vendor: "admin@vendor.com",
      skills: ["Vue.js", "TypeScript"],
      salMin: 130000,
      salMax: 160000,
      note: "Perfect frontend match for Anika.",
      status: "accepted",
    },
    {
      email: "marcus.thompson@test.com",
      name: "Marcus Thompson",
      jobId: BJ[4],
      title: "Senior Java Microservices Developer",
      loc: "Chicago, IL",
      type: "w2",
      sub: "salary",
      vendor: "admin@vendor.com",
      skills: ["Java", "Spring Boot", "Kafka"],
      salMin: 140000,
      salMax: 175000,
      note: "Marcus is ideal for Java microservices.",
      status: "accepted",
    },
    {
      email: "elena.volkov@test.com",
      name: "Elena Volkov",
      jobId: BJ[6],
      title: "AI / LLM Engineer",
      loc: "Remote",
      type: "w2",
      sub: "salary",
      vendor: "admin@vendor.com",
      skills: ["Python", "LLM", "LangChain"],
      salMin: 170000,
      salMax: 220000,
      note: "Elena's ML background is a strong fit.",
      status: "accepted",
    },
    {
      email: "diego.torres@test.com",
      name: "Diego Torres",
      jobId: BJ[2],
      title: "Platform Engineer",
      loc: "San Francisco, CA",
      type: "w2",
      sub: "salary",
      vendor: "admin@vendor.com",
      skills: ["Kubernetes", "AWS", "Terraform"],
      salMin: 150000,
      salMax: 190000,
      note: "Diego's cloud architecture expertise.",
      status: "accepted",
    },
    {
      email: "yuki.tanaka@test.com",
      name: "Yuki Tanaka",
      jobId: BJ[3],
      title: "Android Mobile Developer",
      loc: "Austin, TX",
      type: "1099",
      sub: "hourly",
      vendor: "admin@vendor.com",
      skills: ["Kotlin", "Android", "Firebase"],
      pay: 75,
      note: "Yuki builds cross-platform mobile.",
      status: "accepted",
    },
    {
      email: "sarah.mitchell@test.com",
      name: "Sarah Mitchell",
      jobId: BJ[1],
      title: "Backend Python Engineer",
      loc: "New York, NY",
      type: "c2c",
      sub: "contract",
      vendor: "admin@vendor.com",
      skills: ["Python", "Django", "FastAPI"],
      pay: 90,
      note: "Sarah's Django/FastAPI is ideal.",
      status: "accepted",
    },
    {
      email: "kwame.asante@test.com",
      name: "Kwame Asante",
      jobId: BJ[10],
      title: ".NET Backend Developer",
      loc: "Atlanta, GA",
      type: "c2c",
      sub: "contract",
      vendor: "admin@vendor.com",
      skills: ["C#", ".NET", "Azure"],
      pay: 85,
      note: "Kwame is a strong .NET developer.",
      status: "accepted",
    },
    {
      email: "mei.lin@test.com",
      name: "Mei Lin",
      jobId: BJ[0],
      title: "Senior Vue.js Developer",
      loc: "Remote",
      type: "w2",
      sub: "salary",
      vendor: "admin@vendor.com",
      skills: ["TypeScript", "CSS", "Vue.js"],
      salMin: 130000,
      salMax: 160000,
      note: "Mei's Angular skills transfer to Vue.",
      status: "pending",
    },
    {
      email: "rafael.costa@test.com",
      name: "Rafael Costa",
      jobId: BJ[8],
      title: "Data Platform Architect",
      loc: "Denver, CO",
      type: "w2",
      sub: "salary",
      vendor: "admin@vendor.com",
      skills: ["Snowflake", "dbt", "Airflow"],
      salMin: 160000,
      salMax: 200000,
      note: "Rafael is a modern data stack expert.",
      status: "accepted",
    },
    {
      email: "fatima.alrashid@test.com",
      name: "Fatima Al-Rashid",
      jobId: BJ[27],
      title: "Security Operations Lead",
      loc: "Washington, DC",
      type: "w2",
      sub: "salary",
      vendor: "admin@vendor.com",
      skills: ["SOC", "SIEM", "Incident Response"],
      salMin: 150000,
      salMax: 190000,
      note: "Fatima leads SOC teams.",
      status: "accepted",
    },
    {
      email: "patrick.obrien@test.com",
      name: "Patrick O'Brien",
      jobId: BJ[7],
      title: "Rust Systems Programmer",
      loc: "Boston, MA",
      type: "1099",
      sub: "hourly",
      vendor: "admin@vendor.com",
      skills: ["Rust", "Systems", "Linux"],
      pay: 100,
      note: "Patrick's Rust expertise is top-tier.",
      status: "accepted",
    },
    {
      email: "ingrid.larsson@test.com",
      name: "Ingrid Larsson",
      jobId: BJ[20],
      title: "QA Automation Architect",
      loc: "Chicago, IL",
      type: "w2",
      sub: "salary",
      vendor: "admin@vendor.com",
      skills: ["Playwright", "Cypress", "CI/CD"],
      salMin: 125000,
      salMax: 155000,
      note: "Ingrid designs QA frameworks.",
      status: "accepted",
    },
    {
      email: "chen.wei@test.com",
      name: "Chen Wei",
      jobId: BJ[16],
      title: "NLP Research Engineer",
      loc: "Seattle, WA",
      type: "w2",
      sub: "salary",
      vendor: "admin@vendor.com",
      skills: ["NLP", "Transformers", "PyTorch"],
      salMin: 160000,
      salMax: 200000,
      note: "Chen has a Ph.D. in NLP.",
      status: "accepted",
    },
    {
      email: "isabella.santos@test.com",
      name: "Isabella Santos",
      jobId: BJ[24],
      title: "Mobile Product Designer",
      loc: "New York, NY",
      type: "1099",
      sub: "hourly",
      vendor: "admin@vendor.com",
      skills: ["Figma", "Mobile Design", "Prototyping"],
      pay: 70,
      note: "Isabella creates beautiful mobile UX.",
      status: "accepted",
    },
    {
      email: "alexei.petrov@test.com",
      name: "Alexei Petrov",
      jobId: BJ[17],
      title: "IoT Firmware Developer",
      loc: "Austin, TX",
      type: "1099",
      sub: "hourly",
      vendor: "admin@vendor.com",
      skills: ["C", "C++", "RTOS", "BLE"],
      pay: 85,
      note: "Alexei builds BLE firmware.",
      status: "accepted",
    },
    {
      email: "amara.okafor@test.com",
      name: "Amara Okafor",
      jobId: BJ[15],
      title: "Salesforce Developer",
      loc: "San Diego, CA",
      type: "1099",
      sub: "hourly",
      vendor: "admin@vendor.com",
      skills: ["Salesforce", "Apex"],
      pay: 75,
      note: "Certified SF developer.",
      status: "accepted",
    },
    {
      email: "jordan.kim@test.com",
      name: "Jordan Kim",
      jobId: BJ[5],
      title: "Kubernetes Platform Lead",
      loc: "Seattle, WA",
      type: "c2c",
      sub: "contract",
      vendor: "admin@vendor.com",
      skills: ["Kubernetes", "ArgoCD", "Terraform"],
      pay: 110,
      note: "Jordan runs production K8s.",
      status: "accepted",
    },
    {
      email: "leila.hashemi@test.com",
      name: "Leila Hashemi",
      jobId: BJ[14],
      title: "PostgreSQL Database Administrator",
      loc: "Dallas, TX",
      type: "c2c",
      sub: "contract",
      vendor: "admin@vendor.com",
      skills: ["PostgreSQL", "Replication"],
      pay: 80,
      note: "Leila manages HA PostgreSQL.",
      status: "accepted",
    },
    {
      email: "natasha.williams@test.com",
      name: "Natasha Williams",
      jobId: BJ[13],
      title: "Scrum Master / Agile Coach",
      loc: "New York, NY",
      type: "w2",
      sub: "salary",
      vendor: "admin@vendor.com",
      skills: ["Agile", "Scrum", "JIRA"],
      salMin: 130000,
      salMax: 160000,
      note: "Natasha is a seasoned Agile coach.",
      status: "accepted",
    },
    {
      email: "vikram.khanna@test.com",
      name: "Vikram Khanna",
      jobId: BJ[21],
      title: "GraphQL API Developer",
      loc: "Remote",
      type: "1099",
      sub: "hourly",
      vendor: "admin@vendor.com",
      skills: ["GraphQL", "Node.js", "TypeScript"],
      pay: 80,
      note: "Vikram builds GraphQL APIs.",
      status: "pending",
    },
  ];

  const forwarded = await ForwardedOpening.insertMany(
    fwdData.map((f) => ({
      _id: oid(),
      marketerId: ADMIN_MARKETER,
      marketerEmail: "admin@marketer.com",
      companyId: COMPANY_ID,
      companyName: COMPANY_NAME,
      candidateEmail: f.email,
      candidateName: f.name,
      jobId: f.jobId,
      jobTitle: f.title,
      jobLocation: f.loc,
      jobType: f.type,
      jobSubType: f.sub,
      vendorEmail: f.vendor,
      skillsRequired: f.skills,
      ...(f.pay ? { payPerHour: f.pay } : {}),
      ...(f.salMin ? { salaryMin: f.salMin, salaryMax: f.salMax } : {}),
      note: f.note,
      status: f.status,
    })),
  );
  console.log(`  ✓ Created ${forwarded.length} forwarded openings`);

  /* ================================================================ */
  /*  PROJECT FINANCIALS — 15 projects for new candidates              */
  /* ================================================================ */
  // Map: [appRow.idx, candidateId, candidateName, jobTitle, vendorName, billRate, payRate, hours, stateCode, taxPct%, cashPct%, amountPaid, status, projectStart, notes]
  type FinRow = [
    number,
    string,
    string,
    string,
    string,
    number,
    number,
    number,
    string,
    number,
    number,
    number,
    string,
    string,
    string,
  ];
  const finRows: FinRow[] = [
    [
      0,
      C11,
      "Anika Patel",
      "Senior Vue.js Developer",
      "Admin Vendor",
      88,
      72,
      360,
      "NY",
      6.5,
      0,
      20000,
      "active",
      "2025-06-01",
      "Ongoing frontend engagement",
    ],
    [
      2,
      C12,
      "Marcus Thompson",
      "Senior Java Microservices Dev",
      "Admin Vendor",
      95,
      78,
      480,
      "TX",
      0,
      0,
      30000,
      "active",
      "2025-04-01",
      "Enterprise Java project",
    ],
    [
      4,
      C13,
      "Elena Volkov",
      "AI / LLM Engineer",
      "Admin Vendor",
      110,
      88,
      320,
      "WA",
      0,
      0,
      22000,
      "active",
      "2025-07-01",
      "LLM pipeline development",
    ],
    [
      6,
      C14,
      "Diego Torres",
      "Platform Engineer",
      "Admin Vendor",
      105,
      85,
      400,
      "CA",
      9.3,
      0,
      25000,
      "active",
      "2025-05-01",
      "Multi-cloud platform build",
    ],
    [
      9,
      C15,
      "Yuki Tanaka",
      "Android Mobile Developer",
      "Admin Vendor",
      75,
      62,
      280,
      "MA",
      5.0,
      0,
      12000,
      "active",
      "2025-08-01",
      "Kotlin mobile app",
    ],
    [
      13,
      C16,
      "Sarah Mitchell",
      "Backend Python Engineer",
      "Admin Vendor",
      90,
      72,
      520,
      "CO",
      4.4,
      0,
      30000,
      "active",
      "2025-03-01",
      "Django/FastAPI backend",
    ],
    [
      15,
      C17,
      "Kwame Asante",
      ".NET Backend Developer",
      "Admin Vendor",
      85,
      70,
      240,
      "GA",
      5.49,
      0,
      13000,
      "active",
      "2025-09-01",
      ".NET Azure microservices",
    ],
    [
      18,
      C19,
      "Rafael Costa",
      "Data Platform Architect",
      "Admin Vendor",
      100,
      80,
      360,
      "OR",
      9.9,
      0,
      22000,
      "active",
      "2025-06-01",
      "Snowflake data lakehouse",
    ],
    [
      21,
      C20,
      "Fatima Al-Rashid",
      "Security Operations Lead",
      "Admin Vendor",
      95,
      78,
      440,
      "DC",
      5.75,
      0,
      28000,
      "active",
      "2025-04-01",
      "SOC leadership engagement",
    ],
    [
      24,
      C21,
      "Patrick O'Brien",
      "Rust Systems Programmer",
      "Admin Vendor",
      100,
      82,
      300,
      "MA",
      5.0,
      0,
      18000,
      "active",
      "2025-07-01",
      "Low-latency Rust networking",
    ],
    [
      27,
      C22,
      "Ingrid Larsson",
      "QA Automation Architect",
      "Admin Vendor",
      78,
      65,
      400,
      "MN",
      7.85,
      0,
      20000,
      "active",
      "2025-05-01",
      "Enterprise QA framework",
    ],
    [
      33,
      C25,
      "Chen Wei",
      "NLP Research Engineer",
      "Admin Vendor",
      115,
      92,
      280,
      "WA",
      0,
      0,
      20000,
      "active",
      "2025-08-01",
      "Transformer fine-tuning",
    ],
    [
      39,
      C27,
      "Alexei Petrov",
      "IoT Firmware Developer",
      "Admin Vendor",
      85,
      70,
      600,
      "TX",
      0,
      0,
      40000,
      "completed",
      "2024-10-01",
      "Completed — wearable firmware",
    ],
    [
      42,
      C28,
      "Amara Okafor",
      "Salesforce Developer",
      "Admin Vendor",
      75,
      62,
      360,
      "FL",
      0,
      0,
      22320,
      "completed",
      "2025-01-01",
      "Completed — CPQ implementation",
    ],
    [
      45,
      C29,
      "Jordan Kim",
      "Kubernetes Platform Lead",
      "Admin Vendor",
      110,
      90,
      200,
      "WA",
      0,
      0,
      10000,
      "active",
      "2025-10-01",
      "K8s platform buildout",
    ],
  ];

  // Client / pipeline mock data for testing
  const clientMix = [
    {
      clientName: "Google",
      vendorCompanyName: "",
      implementationPartner: "",
      pocName: "Sarah Henderson",
      pocEmail: "sarah.h@google.com",
    },
    {
      clientName: "Amazon",
      vendorCompanyName: "TechBridge Staffing",
      implementationPartner: "TCS",
      pocName: "Mike Jensen",
      pocEmail: "mike.j@amazon.com",
    },
    {
      clientName: "Meta",
      vendorCompanyName: "Pinnacle Solutions",
      implementationPartner: "Wipro",
      pocName: "Raj Kumar",
      pocEmail: "raj.k@meta.com",
    },
    {
      clientName: "Microsoft",
      vendorCompanyName: "",
      implementationPartner: "",
      pocName: "Anna Brooks",
      pocEmail: "anna.b@microsoft.com",
    },
    {
      clientName: "Amazon",
      vendorCompanyName: "Apex Digital",
      implementationPartner: "Infosys",
      pocName: "Lisa Wang",
      pocEmail: "lisa.w@amazon.com",
    },
    {
      clientName: "Netflix",
      vendorCompanyName: "SecureNet Partners",
      implementationPartner: "HCL Tech",
      pocName: "Chris Park",
      pocEmail: "chris.p@netflix.com",
    },
    {
      clientName: "Google",
      vendorCompanyName: "",
      implementationPartner: "",
      pocName: "David Tan",
      pocEmail: "david.t@google.com",
    },
    {
      clientName: "Microsoft",
      vendorCompanyName: "Apex Digital",
      implementationPartner: "Cognizant",
      pocName: "Tom Richardson",
      pocEmail: "tom.r@microsoft.com",
    },
  ];

  const financials = await ProjectFinancial.insertMany(
    finRows.map(
      (
        [
          appIdx,
          cid,
          cName,
          jTitle,
          vName,
          br,
          pr,
          hrs,
          st,
          tax,
          cash,
          paid,
          status,
          start,
          notes,
        ],
        idx,
      ) => {
        const f = fin(br, pr, hrs, tax, cash, paid);
        const cm = clientMix[idx % clientMix.length];
        return {
          _id: oid(),
          applicationId: BA[appIdx],
          marketerId: ADMIN_MARKETER,
          candidateId: cid,
          candidateName: cName,
          jobTitle: jTitle,
          vendorName: vName,
          vendorCompanyName: cm.vendorCompanyName,
          vendorCompanyId: cm.vendorCompanyName
            ? (vcByName[cm.vendorCompanyName] ?? "")
            : "",
          clientName: cm.clientName,
          clientCompanyId: ccByName[cm.clientName] ?? "",
          implementationPartner: cm.implementationPartner,
          pocName: cm.pocName,
          pocEmail: cm.pocEmail,
          ...f,
          projectStart: new Date(start),
          projectEnd: status === "completed" ? daysAgo(30) : null,
          stateCode: st,
          stateTaxPct: tax,
          cashPct: cash,
          notes,
          status,
        };
      },
    ),
  );
  console.log(`  ✓ Created ${financials.length} project financials`);

  /* ================================================================ */
  /*  TIMESHEETS — 2 weeks per active financial candidate              */
  /* ================================================================ */
  const fullWeek = { mon: 8, tue: 8, wed: 8, thu: 8, fri: 8, sat: 0, sun: 0 };
  const partWeek = { mon: 8, tue: 8, wed: 8, thu: 8, fri: 4, sat: 0, sun: 0 };

  const activeFinRows = finRows.filter(
    ([, , , , , , , , , , , , status]) => status === "active",
  );
  const tsRecords: object[] = [];
  for (const [appIdx, cid, cName, jTitle] of activeFinRows) {
    // Week 1 — approved
    tsRecords.push({
      _id: oid(),
      candidateId: cid,
      candidateName: cName,
      marketerId: ADMIN_MARKETER,
      companyId: COMPANY_ID,
      applicationId: BA[appIdx],
      jobTitle: jTitle,
      weekStart: monday(2),
      entries: fullWeek,
      totalHours: 40,
      status: "approved",
      submittedAt: daysAgo(12),
      approvedAt: daysAgo(11),
    });
    // Week 2 — submitted (pending approval)
    tsRecords.push({
      _id: oid(),
      candidateId: cid,
      candidateName: cName,
      marketerId: ADMIN_MARKETER,
      companyId: COMPANY_ID,
      applicationId: BA[appIdx],
      jobTitle: jTitle,
      weekStart: monday(1),
      entries: fullWeek,
      totalHours: 40,
      status: "submitted",
      submittedAt: daysAgo(3),
    });
    // Current week — draft
    tsRecords.push({
      _id: oid(),
      candidateId: cid,
      candidateName: cName,
      marketerId: ADMIN_MARKETER,
      companyId: COMPANY_ID,
      applicationId: BA[appIdx],
      jobTitle: jTitle,
      weekStart: monday(0),
      entries: partWeek,
      totalHours: 36,
      status: "draft",
    });
  }
  const timesheets = await Timesheet.insertMany(tsRecords);
  console.log(`  ✓ Created ${timesheets.length} timesheets`);

  /* ================================================================ */
  /*  POKE RECORDS — vendor↔candidate pokes for new candidates         */
  /* ================================================================ */
  const pokeRows: {
    sId: string;
    sName: string;
    sEmail: string;
    sType: string;
    tId: string;
    tEmail: string;
    tName: string;
    subject: string;
    isEmail: boolean;
    jId: string;
    jTitle: string;
    tVendorId?: string;
  }[] = [
    // Admin Vendor → new candidates (in-app pokes)
    {
      sId: ADMIN_VENDOR,
      sName: "Admin Vendor",
      sEmail: "admin@vendor.com",
      sType: "vendor",
      tId: C11,
      tEmail: "anika.patel@test.com",
      tName: "Anika Patel",
      subject: "Vue.js role — great frontend profile",
      isEmail: false,
      jId: BJ[0],
      jTitle: "Senior Vue.js Developer",
    },
    {
      sId: ADMIN_VENDOR,
      sName: "Admin Vendor",
      sEmail: "admin@vendor.com",
      sType: "vendor",
      tId: C12,
      tEmail: "marcus.thompson@test.com",
      tName: "Marcus Thompson",
      subject: "Java microservices — strong fit",
      isEmail: false,
      jId: BJ[4],
      jTitle: "Senior Java Microservices Developer",
    },
    {
      sId: ADMIN_VENDOR,
      sName: "Admin Vendor",
      sEmail: "admin@vendor.com",
      sType: "vendor",
      tId: C13,
      tEmail: "elena.volkov@test.com",
      tName: "Elena Volkov",
      subject: "AI/LLM role for your ML background",
      isEmail: false,
      jId: BJ[6],
      jTitle: "AI / LLM Engineer",
    },
    {
      sId: ADMIN_VENDOR,
      sName: "Admin Vendor",
      sEmail: "admin@vendor.com",
      sType: "vendor",
      tId: C14,
      tEmail: "diego.torres@test.com",
      tName: "Diego Torres",
      subject: "Platform engineer — cloud architecture",
      isEmail: false,
      jId: BJ[2],
      jTitle: "Platform Engineer",
    },
    {
      sId: ADMIN_VENDOR,
      sName: "Admin Vendor",
      sEmail: "admin@vendor.com",
      sType: "vendor",
      tId: C16,
      tEmail: "sarah.mitchell@test.com",
      tName: "Sarah Mitchell",
      subject: "Python backend — Django/FastAPI",
      isEmail: false,
      jId: BJ[1],
      jTitle: "Backend Python Engineer",
    },
    {
      sId: ADMIN_VENDOR,
      sName: "Admin Vendor",
      sEmail: "admin@vendor.com",
      sType: "vendor",
      tId: C20,
      tEmail: "fatima.alrashid@test.com",
      tName: "Fatima Al-Rashid",
      subject: "Security ops lead position",
      isEmail: false,
      jId: BJ[27],
      jTitle: "Security Operations Lead",
    },
    {
      sId: ADMIN_VENDOR,
      sName: "Admin Vendor",
      sEmail: "admin@vendor.com",
      sType: "vendor",
      tId: C21,
      tEmail: "patrick.obrien@test.com",
      tName: "Patrick O'Brien",
      subject: "Rust systems — networking stack",
      isEmail: false,
      jId: BJ[7],
      jTitle: "Rust Systems Programmer",
    },
    {
      sId: ADMIN_VENDOR,
      sName: "Admin Vendor",
      sEmail: "admin@vendor.com",
      sType: "vendor",
      tId: C25,
      tEmail: "chen.wei@test.com",
      tName: "Chen Wei",
      subject: "NLP research role",
      isEmail: false,
      jId: BJ[16],
      jTitle: "NLP Research Engineer",
    },
    {
      sId: ADMIN_VENDOR,
      sName: "Admin Vendor",
      sEmail: "admin@vendor.com",
      sType: "vendor",
      tId: C29,
      tEmail: "jordan.kim@test.com",
      tName: "Jordan Kim",
      subject: "K8s platform lead opportunity",
      isEmail: false,
      jId: BJ[5],
      jTitle: "Kubernetes Platform Lead",
    },
    // Vendor → candidate EMAILS
    {
      sId: ADMIN_VENDOR,
      sName: "Admin Vendor",
      sEmail: "admin@vendor.com",
      sType: "vendor",
      tId: C11,
      tEmail: "anika.patel@test.com",
      tName: "Anika Patel",
      subject: "Follow-up: Vue.js Developer details",
      isEmail: true,
      jId: BJ[0],
      jTitle: "Senior Vue.js Developer",
    },
    {
      sId: ADMIN_VENDOR,
      sName: "Admin Vendor",
      sEmail: "admin@vendor.com",
      sType: "vendor",
      tId: C12,
      tEmail: "marcus.thompson@test.com",
      tName: "Marcus Thompson",
      subject: "Java role — compensation details",
      isEmail: true,
      jId: BJ[4],
      jTitle: "Senior Java Microservices Developer",
    },
    // Candidate → Vendor POKES
    {
      sId: C11,
      sName: "Anika Patel",
      sEmail: "anika.patel@test.com",
      sType: "candidate",
      tId: ADMIN_VENDOR,
      tVendorId: ADMIN_VENDOR,
      tEmail: "admin@vendor.com",
      tName: "Admin Vendor",
      subject: "Interested in Vue.js role",
      isEmail: false,
      jId: BJ[0],
      jTitle: "Senior Vue.js Developer",
    },
    {
      sId: C14,
      sName: "Diego Torres",
      sEmail: "diego.torres@test.com",
      sType: "candidate",
      tId: ADMIN_VENDOR,
      tVendorId: ADMIN_VENDOR,
      tEmail: "admin@vendor.com",
      tName: "Admin Vendor",
      subject: "Platform Engineer — very interested",
      isEmail: false,
      jId: BJ[2],
      jTitle: "Platform Engineer",
    },
    {
      sId: C16,
      sName: "Sarah Mitchell",
      sEmail: "sarah.mitchell@test.com",
      sType: "candidate",
      tId: ADMIN_VENDOR,
      tVendorId: ADMIN_VENDOR,
      tEmail: "admin@vendor.com",
      tName: "Admin Vendor",
      subject: "Python backend — availability",
      isEmail: false,
      jId: BJ[1],
      jTitle: "Backend Python Engineer",
    },
    {
      sId: C21,
      sName: "Patrick O'Brien",
      sEmail: "patrick.obrien@test.com",
      sType: "candidate",
      tId: ADMIN_VENDOR,
      tVendorId: ADMIN_VENDOR,
      tEmail: "admin@vendor.com",
      tName: "Admin Vendor",
      subject: "Rust role — portfolio and rates",
      isEmail: false,
      jId: BJ[7],
      jTitle: "Rust Systems Programmer",
    },
    {
      sId: C25,
      sName: "Chen Wei",
      sEmail: "chen.wei@test.com",
      sType: "candidate",
      tId: ADMIN_VENDOR,
      tVendorId: ADMIN_VENDOR,
      tEmail: "admin@vendor.com",
      tName: "Admin Vendor",
      subject: "NLP position — Ph.D. research",
      isEmail: false,
      jId: BJ[16],
      jTitle: "NLP Research Engineer",
    },
    // (Marketer→Vendor pokes already exist in base seed — skipped to avoid dup key)
    // Candidate → Vendor EMAILS
    {
      sId: C12,
      sName: "Marcus Thompson",
      sEmail: "marcus.thompson@test.com",
      sType: "candidate",
      tId: ADMIN_VENDOR,
      tVendorId: ADMIN_VENDOR,
      tEmail: "admin@vendor.com",
      tName: "Admin Vendor",
      subject: "Re: Java role — resume attached",
      isEmail: true,
      jId: BJ[4],
      jTitle: "Senior Java Microservices Developer",
    },
    {
      sId: C13,
      sName: "Elena Volkov",
      sEmail: "elena.volkov@test.com",
      sType: "candidate",
      tId: ADMIN_VENDOR,
      tVendorId: ADMIN_VENDOR,
      tEmail: "admin@vendor.com",
      tName: "Admin Vendor",
      subject: "AI/LLM — published papers",
      isEmail: true,
      jId: BJ[6],
      jTitle: "AI / LLM Engineer",
    },
  ];

  const pokes = await PokeRecord.insertMany(
    pokeRows.map((p) => ({
      _id: oid(),
      senderId: p.sId,
      senderName: p.sName,
      senderEmail: p.sEmail,
      senderType: p.sType,
      targetId: p.tId,
      ...(p.tVendorId ? { targetVendorId: p.tVendorId } : {}),
      targetEmail: p.tEmail,
      targetName: p.tName,
      subject: p.subject,
      isEmail: p.isEmail,
      jobId: p.jId,
      jobTitle: p.jTitle,
    })),
  );
  console.log(`  ✓ Created ${pokes.length} poke records`);

  /* ================================================================ */
  /*  POKE LOGS — monthly usage for new candidates                     */
  /* ================================================================ */
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const bulkLogs = await PokeLog.insertMany(
    [C11, C12, C13, C14, C16, C21, C25].map((uid) => ({
      _id: oid(),
      userId: uid,
      yearMonth: ym,
      count: Math.floor(Math.random() * 4) + 1,
    })),
  );
  console.log(`  ✓ Created ${bulkLogs.length} poke logs`);

  /* ================================================================ */
  /*  INTERVIEW INVITES — 10 upcoming interviews                       */
  /* ================================================================ */
  const interviews = await InterviewInvite.insertMany([
    {
      _id: oid(),
      vendorId: ADMIN_VENDOR,
      vendorEmail: "admin@vendor.com",
      vendorName: "Admin Vendor",
      candidateEmail: "anika.patel@test.com",
      candidateName: "Anika Patel",
      jobId: BJ[0],
      jobTitle: "Senior Vue.js Developer",
      interviewDate: daysFromNow(2),
      interviewTime: "10:00 AM EST",
      interviewType: "video",
      interviewLink: "https://meet.example.com/vue-anika",
      notes: "Technical: Vue 3 deep dive",
      status: "pending",
    },
    {
      _id: oid(),
      vendorId: ADMIN_VENDOR,
      vendorEmail: "admin@vendor.com",
      vendorName: "Admin Vendor",
      candidateEmail: "marcus.thompson@test.com",
      candidateName: "Marcus Thompson",
      jobId: BJ[4],
      jobTitle: "Senior Java Microservices Developer",
      interviewDate: daysFromNow(3),
      interviewTime: "2:00 PM CST",
      interviewType: "video",
      interviewLink: "https://meet.example.com/java-marcus",
      notes: "System design — Kafka + microservices",
      status: "accepted",
    },
    {
      _id: oid(),
      vendorId: ADMIN_VENDOR,
      vendorEmail: "admin@vendor.com",
      vendorName: "Admin Vendor",
      candidateEmail: "elena.volkov@test.com",
      candidateName: "Elena Volkov",
      jobId: BJ[6],
      jobTitle: "AI / LLM Engineer",
      interviewDate: daysFromNow(4),
      interviewTime: "11:00 AM PST",
      interviewType: "video",
      interviewLink: "https://meet.example.com/ai-elena",
      notes: "ML system design + LLM evaluation",
      status: "pending",
    },
    {
      _id: oid(),
      vendorId: ADMIN_VENDOR,
      vendorEmail: "admin@vendor.com",
      vendorName: "Admin Vendor",
      candidateEmail: "diego.torres@test.com",
      candidateName: "Diego Torres",
      jobId: BJ[2],
      jobTitle: "Platform Engineer",
      interviewDate: daysFromNow(5),
      interviewTime: "1:00 PM PST",
      interviewType: "video",
      interviewLink: "https://meet.example.com/platform-diego",
      notes: "Cloud architecture walkthrough",
      status: "accepted",
    },
    {
      _id: oid(),
      vendorId: ADMIN_VENDOR,
      vendorEmail: "admin@vendor.com",
      vendorName: "Admin Vendor",
      candidateEmail: "sarah.mitchell@test.com",
      candidateName: "Sarah Mitchell",
      jobId: BJ[1],
      jobTitle: "Backend Python Engineer",
      interviewDate: daysFromNow(3),
      interviewTime: "3:00 PM EST",
      interviewType: "phone",
      interviewLink: "",
      notes: "Phone screen — Django/FastAPI",
      status: "pending",
    },
    {
      _id: oid(),
      vendorId: ADMIN_VENDOR,
      vendorEmail: "admin@vendor.com",
      vendorName: "Admin Vendor",
      candidateEmail: "patrick.obrien@test.com",
      candidateName: "Patrick O'Brien",
      jobId: BJ[7],
      jobTitle: "Rust Systems Programmer",
      interviewDate: daysFromNow(6),
      interviewTime: "10:00 AM PST",
      interviewType: "video",
      interviewLink: "https://meet.example.com/rust-patrick",
      notes: "Systems programming + concurrency",
      status: "pending",
    },
    {
      _id: oid(),
      vendorId: ADMIN_VENDOR,
      vendorEmail: "admin@vendor.com",
      vendorName: "Admin Vendor",
      candidateEmail: "chen.wei@test.com",
      candidateName: "Chen Wei",
      jobId: BJ[16],
      jobTitle: "NLP Research Engineer",
      interviewDate: daysFromNow(2),
      interviewTime: "4:00 PM EST",
      interviewType: "video",
      interviewLink: "https://meet.example.com/nlp-chen",
      notes: "NLP research presentation",
      status: "accepted",
    },
    {
      _id: oid(),
      vendorId: ADMIN_VENDOR,
      vendorEmail: "admin@vendor.com",
      vendorName: "Admin Vendor",
      candidateEmail: "jordan.kim@test.com",
      candidateName: "Jordan Kim",
      jobId: BJ[5],
      jobTitle: "Kubernetes Platform Lead",
      interviewDate: daysFromNow(4),
      interviewTime: "9:00 AM PST",
      interviewType: "video",
      interviewLink: "https://meet.example.com/k8s-jordan",
      notes: "K8s architecture + GitOps discussion",
      status: "pending",
    },
    {
      _id: oid(),
      vendorId: ADMIN_VENDOR,
      vendorEmail: "admin@vendor.com",
      vendorName: "Admin Vendor",
      candidateEmail: "fatima.alrashid@test.com",
      candidateName: "Fatima Al-Rashid",
      jobId: BJ[27],
      jobTitle: "Security Operations Lead",
      interviewDate: daysFromNow(7),
      interviewTime: "11:00 AM EST",
      interviewType: "video",
      interviewLink: "https://meet.example.com/sec-fatima",
      notes: "SOC operations + incident response",
      status: "pending",
    },
    {
      _id: oid(),
      vendorId: ADMIN_VENDOR,
      vendorEmail: "admin@vendor.com",
      vendorName: "Admin Vendor",
      candidateEmail: "ingrid.larsson@test.com",
      candidateName: "Ingrid Larsson",
      jobId: BJ[20],
      jobTitle: "QA Automation Architect",
      interviewDate: daysFromNow(5),
      interviewTime: "2:00 PM CST",
      interviewType: "video",
      interviewLink: "https://meet.example.com/qa-ingrid",
      notes: "QA framework architecture discussion",
      status: "accepted",
    },
  ]);
  console.log(`  ✓ Created ${interviews.length} interview invites`);

  /* ================================================================ */
  /*  Summary                                                          */
  /* ================================================================ */
  console.log("\n✅ Bulk jobs seed complete!");
  console.log(
    `   ${bulkJobs.length} jobs, ${profiles.length} profiles, ${applications.length} applications`,
  );
  console.log(
    `   ${mcRecords.length} marketer-candidate links, ${forwarded.length} forwarded openings`,
  );
  console.log(
    `   ${financials.length} project financials, ${timesheets.length} timesheets`,
  );
  console.log(
    `   ${pokes.length} pokes, ${bulkLogs.length} poke logs, ${interviews.length} interviews\n`,
  );

  await disconnectMongo();
}

seedBulk().catch((err) => {
  console.error("Bulk seed failed:", err);
  process.exit(1);
});
