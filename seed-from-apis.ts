/**
 * Seed script – fetches REAL job listings from free public APIs
 * and inserts them into MongoDB (matchdb_jobs).
 *
 * APIs used:
 *   1. Remotive     – remote tech jobs (software-dev, devops, etc.)
 *   2. TheMuse      – general jobs (no API key for basic access)
 *   3. Arbeitnow    – EU / international jobs
 *
 * Run:  npx tsx seed-from-apis.ts
 *
 * Env:  MONGO_URI  (default mongodb://localhost:27017)
 *       MONGO_DB_NAME (default matchdb_jobs)
 */
import mongoose, { Schema } from "mongoose";

// ─── Config ──────────────────────────────────────────────────────────────────
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017";
const MONGO_DB = process.env.MONGO_DB_NAME || "matchdb_jobs";

// Vendor IDs from shell-services seed (we assign API jobs to these vendors)
const VENDOR_POOL = [
  { id: "d8c0acdc-07f4-4f4e-9b71-5e0f6d0f1745", email: "dan@techcorp.com",       name: "Dan Brown",       phone: "+1-555-0101" },
  { id: "b25adc3b-d440-470f-9390-54794dd95f89", email: "eve@hirehub.io",          name: "Eve Martinez",    phone: "+1-555-0202" },
  { id: "379a35d5-c33b-46ec-8c7a-79ec54d4378b", email: "frank@globalstaffing.com", name: "Frank Wilson",    phone: "+1-555-0303" },
  { id: "a1b2c3d4-2222-4bbb-b222-000000000001", email: "nina@cloudnine.io",        name: "Nina Patel",      phone: "+1-555-0404" },
  { id: "a1b2c3d4-2222-4bbb-b222-000000000002", email: "oscar@talentbridge.com",   name: "Oscar Kim",       phone: "+1-555-0505" },
  { id: "a1b2c3d4-2222-4bbb-b222-000000000003", email: "paula@nexusrecruit.com",   name: "Paula Chen",      phone: "+1-555-0606" },
  { id: "a1b2c3d4-2222-4bbb-b222-000000000004", email: "quinn@eliteplacements.co", name: "Quinn O'Brien",   phone: "+1-555-0707" },
];

// ─── Mongoose Model (inline, same as seed.ts) ───────────────────────────────
const JobModel = mongoose.model(
  "Job",
  new Schema(
    {
      title: String,
      description: String,
      vendorId: String,
      vendorEmail: String,
      recruiterName: String,
      recruiterPhone: String,
      location: String,
      jobCountry: { type: String, default: "" },
      jobState: { type: String, default: "" },
      jobCity: { type: String, default: "" },
      jobType: String,
      jobSubType: { type: String, default: "" },
      workMode: { type: String, default: "" },
      salaryMin: { type: Number, default: null },
      salaryMax: { type: Number, default: null },
      payPerHour: { type: Number, default: null },
      skillsRequired: [String],
      experienceRequired: { type: Number, default: 0 },
      isActive: { type: Boolean, default: true },
    },
    { timestamps: true, collection: "jobs" },
  ),
);

// ─── Helpers ─────────────────────────────────────────────────────────────────
function randomVendor() {
  return VENDOR_POOL[Math.floor(Math.random() * VENDOR_POOL.length)];
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 3000); // cap description length
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

type JobTypeEnum = "full_time" | "part_time" | "contract" | "internship";
type WorkModeEnum = "remote" | "onsite" | "hybrid" | "";

function normalizeJobType(raw: string): JobTypeEnum {
  const s = raw.toLowerCase().replace(/[\s-]/g, "_");
  if (s.includes("full")) return "full_time";
  if (s.includes("part")) return "part_time";
  if (s.includes("contract") || s.includes("freelance")) return "contract";
  if (s.includes("intern")) return "internship";
  return "full_time";
}

/** Parse salary strings like "$65K - $80K", "$120 - $170 /hour", "60000-90000" */
function parseSalary(salaryStr: string): {
  salaryMin: number | null;
  salaryMax: number | null;
  payPerHour: number | null;
} {
  if (!salaryStr) return { salaryMin: null, salaryMax: null, payPerHour: null };

  const isHourly = /\/(hr|hour)/i.test(salaryStr);
  // Extract all numbers (handle K suffix)
  const nums: number[] = [];
  const regex = /\$?([\d,]+(?:\.\d+)?)\s*[kK]?/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(salaryStr)) !== null) {
    let n = parseFloat(match[1].replace(/,/g, ""));
    if (/[kK]/.test(salaryStr.slice(match.index, match.index + match[0].length + 1))) {
      n *= 1000;
    }
    if (n > 0) nums.push(n);
  }

  if (nums.length === 0) return { salaryMin: null, salaryMax: null, payPerHour: null };

  if (isHourly) {
    return {
      salaryMin: null,
      salaryMax: null,
      payPerHour: nums[0],
    };
  }

  // If values look like hourly (< 500), treat as hourly
  if (nums[0] < 500) {
    return { salaryMin: null, salaryMax: null, payPerHour: nums[0] };
  }

  return {
    salaryMin: nums[0] || null,
    salaryMax: nums[1] || nums[0] || null,
    payPerHour: null,
  };
}

/** Parse location string into country/state/city best-effort */
function parseLocation(locStr: string): {
  location: string;
  jobCountry: string;
  jobState: string;
  jobCity: string;
  workMode: WorkModeEnum;
} {
  const raw = (locStr || "").trim();
  let workMode: WorkModeEnum = "";

  if (/remote/i.test(raw)) workMode = "remote";
  else if (/hybrid/i.test(raw)) workMode = "hybrid";
  else if (raw.length > 0) workMode = "onsite";

  // Simple US-state parsing "City, ST" or "City, State"
  const usParts = raw.match(/^([^,]+),\s*([A-Z]{2})\b/);
  if (usParts) {
    return {
      location: raw,
      jobCity: usParts[1].trim(),
      jobState: usParts[2],
      jobCountry: "US",
      workMode,
    };
  }

  // "City, Country" or just country
  const parts = raw.split(",").map((s) => s.trim());
  return {
    location: raw,
    jobCity: parts.length > 1 ? parts[0] : "",
    jobState: "",
    jobCountry: parts[parts.length - 1] || "",
    workMode,
  };
}

interface SeedJob {
  title: string;
  description: string;
  location: string;
  jobCountry: string;
  jobState: string;
  jobCity: string;
  jobType: JobTypeEnum;
  jobSubType: string;
  workMode: WorkModeEnum;
  salaryMin: number | null;
  salaryMax: number | null;
  payPerHour: number | null;
  skillsRequired: string[];
  experienceRequired: number;
  source: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Fetchers
// ═══════════════════════════════════════════════════════════════════════════════

/** ── Remotive ─────────────────────────────────────────────────────────────── */
async function fetchRemotive(): Promise<SeedJob[]> {
  const categories = [
    "software-dev",
    "devops",
    "data",
    "product",
    "design",
    "customer-support",
    "marketing",
    "qa",
  ];
  const jobs: SeedJob[] = [];

  for (const cat of categories) {
    try {
      const url = `https://remotive.com/api/remote-jobs?category=${cat}&limit=50`;
      console.log(`  [Remotive] fetching ${cat}...`);
      const res = await fetch(url);
      if (!res.ok) { console.log(`  [Remotive] ${cat} → ${res.status}`); continue; }
      const data = (await res.json()) as any;
      for (const j of data.jobs || []) {
        const loc = parseLocation(j.candidate_required_location || "Remote");
        const sal = parseSalary(j.salary || "");
        jobs.push({
          title: j.title,
          description: stripHtml(j.description || ""),
          ...loc,
          workMode: "remote",
          jobType: normalizeJobType(j.job_type || "full_time"),
          jobSubType: j.category || cat,
          ...sal,
          skillsRequired: (j.tags || []).slice(0, 10),
          experienceRequired: 0,
          source: "remotive",
        });
      }
      await sleep(300); // rate-limit courtesy
    } catch (e: any) {
      console.log(`  [Remotive] ${cat} error: ${e.message}`);
    }
  }
  return jobs;
}

/** ── TheMuse ──────────────────────────────────────────────────────────────── */
async function fetchTheMuse(): Promise<SeedJob[]> {
  const jobs: SeedJob[] = [];
  const pages = [1, 2, 3, 4, 5]; // 20 per page → 100 jobs

  for (const page of pages) {
    try {
      const url = `https://www.themuse.com/api/public/jobs?page=${page}`;
      console.log(`  [TheMuse] fetching page ${page}...`);
      const res = await fetch(url);
      if (!res.ok) { console.log(`  [TheMuse] page ${page} → ${res.status}`); continue; }
      const data = (await res.json()) as any;
      for (const j of data.results || []) {
        const rawLoc = j.locations?.map((l: any) => l.name).join("; ") || "";
        const loc = parseLocation(rawLoc);
        const level = j.levels?.map((l: any) => l.name).join(", ") || "";
        const category = j.categories?.map((c: any) => c.name).join(", ") || "";
        jobs.push({
          title: j.name || j.title || "Untitled",
          description: stripHtml(j.contents || ""),
          ...loc,
          jobType: "full_time",
          jobSubType: category,
          ...parseSalary(""),
          skillsRequired: category ? category.split(",").map((s: string) => s.trim()) : [],
          experienceRequired: /senior|lead|principal|staff/i.test(level) ? 5 : /mid/i.test(level) ? 3 : 0,
          source: "themuse",
        });
      }
      await sleep(500);
    } catch (e: any) {
      console.log(`  [TheMuse] page ${page} error: ${e.message}`);
    }
  }
  return jobs;
}

/** ── Arbeitnow ────────────────────────────────────────────────────────────── */
async function fetchArbeitnow(): Promise<SeedJob[]> {
  const jobs: SeedJob[] = [];
  const pages = [1, 2]; // 100 per page → 200 jobs

  for (const page of pages) {
    try {
      const url = `https://www.arbeitnow.com/api/job-board-api?page=${page}`;
      console.log(`  [Arbeitnow] fetching page ${page}...`);
      const res = await fetch(url);
      if (!res.ok) { console.log(`  [Arbeitnow] page ${page} → ${res.status}`); continue; }
      const data = (await res.json()) as any;
      for (const j of data.data || []) {
        const loc = parseLocation(j.location || "");
        jobs.push({
          title: j.title,
          description: stripHtml(j.description || ""),
          ...loc,
          workMode: j.remote === true ? "remote" : loc.workMode,
          jobType: "full_time",
          jobSubType: "",
          ...parseSalary(""),
          skillsRequired: (j.tags || []).slice(0, 10),
          experienceRequired: 0,
          source: "arbeitnow",
        });
      }
      await sleep(500);
    } catch (e: any) {
      console.log(`  [Arbeitnow] page ${page} error: ${e.message}`);
    }
  }
  return jobs;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════════════════════════
async function main() {
  console.log("Connecting to MongoDB...");
  await mongoose.connect(`${MONGO_URI}/${MONGO_DB}`);
  console.log("Connected!\n");

  // Fetch from all 3 APIs in parallel
  console.log("Fetching jobs from free APIs...\n");
  const [remotiveJobs, museJobs, arbeitnowJobs] = await Promise.all([
    fetchRemotive(),
    fetchTheMuse(),
    fetchArbeitnow(),
  ]);

  const allJobs = [...remotiveJobs, ...museJobs, ...arbeitnowJobs];
  console.log(`\nFetched totals:`);
  console.log(`  Remotive:  ${remotiveJobs.length}`);
  console.log(`  TheMuse:   ${museJobs.length}`);
  console.log(`  Arbeitnow: ${arbeitnowJobs.length}`);
  console.log(`  TOTAL:     ${allJobs.length}`);

  // Deduplicate by normalised title + first 50 chars of description
  const seen = new Set<string>();
  const unique: SeedJob[] = [];
  for (const j of allJobs) {
    const key = `${j.title.toLowerCase().trim()}|${j.description.slice(0, 50)}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(j);
    }
  }
  console.log(`  After dedup: ${unique.length}\n`);

  // Map to Mongo documents (round-robin assign to vendor pool)
  const docs = unique.map((j, i) => {
    const vendor = VENDOR_POOL[i % VENDOR_POOL.length];
    return {
      title: j.title,
      description: j.description || "No description provided.",
      vendorId: vendor.id,
      vendorEmail: vendor.email,
      recruiterName: vendor.name,
      recruiterPhone: vendor.phone,
      location: j.location,
      jobCountry: j.jobCountry,
      jobState: j.jobState,
      jobCity: j.jobCity,
      jobType: j.jobType,
      jobSubType: j.jobSubType,
      workMode: j.workMode,
      salaryMin: j.salaryMin,
      salaryMax: j.salaryMax,
      payPerHour: j.payPerHour,
      skillsRequired: j.skillsRequired,
      experienceRequired: j.experienceRequired,
      isActive: true,
    };
  });

  // Insert (don't delete existing jobs – additive seed)
  console.log(`Inserting ${docs.length} jobs into MongoDB...`);
  const result = await JobModel.insertMany(docs, { ordered: false });
  console.log(`Inserted ${result.length} jobs successfully!\n`);

  // Summary by source
  const bySrc: Record<string, number> = {};
  for (const j of unique) bySrc[j.source] = (bySrc[j.source] || 0) + 1;
  console.log("By source:");
  for (const [src, count] of Object.entries(bySrc)) {
    console.log(`  ${src}: ${count}`);
  }

  const total = await JobModel.countDocuments();
  console.log(`\nTotal jobs in DB: ${total}`);

  await mongoose.disconnect();
  console.log("Done!");
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
