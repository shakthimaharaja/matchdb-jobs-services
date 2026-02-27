/**
 * seed-10k.ts  —  Seed 10 000 Jobs + 10 000 Candidate Profiles
 *
 * Usage:   npx tsx seed-10k.ts
 *
 * Also creates ~5 000 applications and ~2 000 poke records.
 * Uses batch insertMany (1 000 docs per batch) for performance.
 */

import mongoose, { Schema, model } from "mongoose";
import { randomUUID } from "crypto";

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017";
const MONGO_DB = process.env.MONGO_DB || "matchdb_jobs";

const BATCH = 1_000; // docs per insertMany call

/* ═══════════════════════════════════════════════════════════════════
   Standalone Schemas (so the script runs independently of src/)
   ═══════════════════════════════════════════════════════════════════ */

const JobModel = model(
  "Job",
  new Schema(
    {
      title: { type: String, required: true, trim: true },
      description: { type: String, required: true },
      vendorId: { type: String, required: true, index: true },
      vendorEmail: { type: String, required: true },
      recruiterName: { type: String, default: "" },
      recruiterPhone: { type: String, default: "" },
      location: { type: String, default: "" },
      jobCountry: { type: String, default: "", index: true },
      jobState: { type: String, default: "" },
      jobCity: { type: String, default: "" },
      jobType: {
        type: String,
        enum: ["full_time", "part_time", "contract", "internship"],
        default: "full_time",
      },
      jobSubType: { type: String, default: "" },
      workMode: {
        type: String,
        enum: ["remote", "onsite", "hybrid", ""],
        default: "",
      },
      salaryMin: { type: Number, default: null },
      salaryMax: { type: Number, default: null },
      payPerHour: { type: Number, default: null },
      skillsRequired: [{ type: String }],
      experienceRequired: { type: Number, default: 0 },
      isActive: { type: Boolean, default: true, index: true },
    },
    { timestamps: true },
  ),
  "jobs",
);

const ProfileModel = model(
  "CandidateProfile",
  new Schema(
    {
      candidateId: { type: String, required: true, unique: true, index: true },
      username: { type: String, default: "", index: true },
      name: { type: String, default: "" },
      email: { type: String, default: "" },
      phone: { type: String, default: "" },
      currentCompany: { type: String, default: "" },
      currentRole: { type: String, default: "" },
      preferredJobType: { type: String, default: "" },
      expectedHourlyRate: { type: Number, default: null },
      experienceYears: { type: Number, default: 0 },
      skills: [{ type: String }],
      location: { type: String, default: "" },
      profileCountry: { type: String, default: "", index: true },
      bio: { type: String, default: "" },
      resumeSummary: { type: String, default: "" },
      resumeExperience: { type: String, default: "" },
      resumeEducation: { type: String, default: "" },
      resumeAchievements: { type: String, default: "" },
      visibilityConfig: { type: Schema.Types.Mixed, default: {} },
      profileLocked: { type: Boolean, default: false },
    },
    { timestamps: true },
  ),
  "candidateprofiles",
);

const AppModel = model(
  "Application",
  new Schema(
    {
      jobId: { type: String, required: true, index: true },
      jobTitle: { type: String, default: "" },
      candidateId: { type: String, required: true, index: true },
      candidateEmail: { type: String, default: "" },
      coverLetter: { type: String, default: "" },
      status: {
        type: String,
        enum: ["pending", "reviewing", "shortlisted", "rejected", "hired"],
        default: "pending",
      },
    },
    { timestamps: true },
  ),
  "applications",
);

const PokeRecordModel = model(
  "PokeRecord",
  new Schema(
    {
      senderId: { type: String, required: true },
      senderName: { type: String, default: "" },
      senderEmail: { type: String, default: "" },
      senderType: { type: String, enum: ["vendor", "candidate"], required: true },
      targetId: { type: String, required: true },
      targetVendorId: { type: String, default: "" },
      targetEmail: { type: String, default: "" },
      targetName: { type: String, default: "" },
      subject: { type: String, default: "" },
      isEmail: { type: Boolean, default: false },
      jobId: { type: String, default: "" },
      jobTitle: { type: String, default: "" },
    },
    { timestamps: true },
  ),
  "pokerecords",
);

const PokeLogModel = model(
  "PokeLog",
  new Schema(
    {
      userId: { type: String, required: true },
      yearMonth: { type: String, required: true },
      count: { type: Number, default: 0 },
    },
    { timestamps: true },
  ),
  "pokelogs",
);

/* ═══════════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════════ */

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function pickN<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  const result: T[] = [];
  for (let i = 0; i < Math.min(n, copy.length); i++) {
    const idx = Math.floor(Math.random() * copy.length);
    result.push(copy.splice(idx, 1)[0]);
  }
  return result;
}
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function randDate(daysBack: number): Date {
  const now = Date.now();
  return new Date(now - Math.random() * daysBack * 86_400_000);
}

/** Insert docs in batches of BATCH */
async function batchInsert(model: any, docs: any[], label: string) {
  let inserted = 0;
  for (let i = 0; i < docs.length; i += BATCH) {
    const slice = docs.slice(i, i + BATCH);
    await model.insertMany(slice, { ordered: false });
    inserted += slice.length;
    process.stdout.write(`   ${label}: ${inserted}/${docs.length}\r`);
  }
  console.log(`   ${label}: ${inserted}/${docs.length} ✓`);
  return inserted;
}

/* ═══════════════════════════════════════════════════════════════════
   Data Pools
   ═══════════════════════════════════════════════════════════════════ */

const VENDORS = [
  { id: "11111111-aaaa-bbbb-cccc-000000000001", name: "Sita Patel", email: "sita.patel@vendorcorp.com", company: "VendorCorp", phone: "+1-555-0101" },
  { id: "11111111-aaaa-bbbb-cccc-000000000002", name: "Ravi Kumar", email: "ravi.kumar@globalstaffing.com", company: "Global Staffing", phone: "+1-555-0102" },
  { id: "11111111-aaaa-bbbb-cccc-000000000003", name: "Emily Chen", email: "emily.chen@techrecruit.io", company: "TechRecruit", phone: "+1-555-0103" },
  { id: "11111111-aaaa-bbbb-cccc-000000000004", name: "Jamal Williams", email: "jamal@elitetalent.com", company: "Elite Talent", phone: "+1-555-0104" },
  { id: "11111111-aaaa-bbbb-cccc-000000000005", name: "Priya Sharma", email: "priya@recruitplus.io", company: "RecruitPlus", phone: "+1-555-0105" },
  { id: "11111111-aaaa-bbbb-cccc-000000000006", name: "Tom Bradley", email: "tom@tekhire.com", company: "TekHire", phone: "+1-555-0106" },
  { id: "11111111-aaaa-bbbb-cccc-000000000007", name: "Aisha Rahman", email: "aisha@peoplefirst.com", company: "People First", phone: "+1-555-0107" },
  { id: "11111111-aaaa-bbbb-cccc-000000000008", name: "Mike Johnson", email: "mike.j@staffworld.com", company: "StaffWorld", phone: "+1-555-0108" },
  { id: "11111111-aaaa-bbbb-cccc-000000000009", name: "Lena Kowalski", email: "lena@brightpath.io", company: "BrightPath", phone: "+1-555-0109" },
  { id: "11111111-aaaa-bbbb-cccc-000000000010", name: "Daniel Chang", email: "daniel@nexthire.com", company: "NextHire", phone: "+1-555-0110" },
  { id: "11111111-aaaa-bbbb-cccc-000000000011", name: "Sarah Lopez", email: "sarah@talentsync.io", company: "TalentSync", phone: "+1-555-0111" },
  { id: "11111111-aaaa-bbbb-cccc-000000000012", name: "Alex Peterson", email: "alex@sparkrecruit.com", company: "SparkRecruit", phone: "+1-555-0112" },
  { id: "11111111-aaaa-bbbb-cccc-000000000013", name: "Wei Zhang", email: "wei@codehire.io", company: "CodeHire", phone: "+1-555-0113" },
  { id: "11111111-aaaa-bbbb-cccc-000000000014", name: "Nina Patel", email: "nina@hirevault.com", company: "HireVault", phone: "+1-555-0114" },
  { id: "11111111-aaaa-bbbb-cccc-000000000015", name: "Chris Turner", email: "chris@apextalent.com", company: "ApexTalent", phone: "+1-555-0115" },
];

// ── Location data with country/state/city breakdown ──

interface Loc {
  display: string;
  city: string;
  state: string;
  country: string;
}

const LOCATIONS: Loc[] = [
  { display: "San Francisco, CA", city: "San Francisco", state: "California", country: "United States" },
  { display: "New York, NY", city: "New York", state: "New York", country: "United States" },
  { display: "Seattle, WA", city: "Seattle", state: "Washington", country: "United States" },
  { display: "Austin, TX", city: "Austin", state: "Texas", country: "United States" },
  { display: "Chicago, IL", city: "Chicago", state: "Illinois", country: "United States" },
  { display: "Boston, MA", city: "Boston", state: "Massachusetts", country: "United States" },
  { display: "Denver, CO", city: "Denver", state: "Colorado", country: "United States" },
  { display: "Los Angeles, CA", city: "Los Angeles", state: "California", country: "United States" },
  { display: "Atlanta, GA", city: "Atlanta", state: "Georgia", country: "United States" },
  { display: "Dallas, TX", city: "Dallas", state: "Texas", country: "United States" },
  { display: "Portland, OR", city: "Portland", state: "Oregon", country: "United States" },
  { display: "Miami, FL", city: "Miami", state: "Florida", country: "United States" },
  { display: "Phoenix, AZ", city: "Phoenix", state: "Arizona", country: "United States" },
  { display: "Minneapolis, MN", city: "Minneapolis", state: "Minnesota", country: "United States" },
  { display: "San Diego, CA", city: "San Diego", state: "California", country: "United States" },
  { display: "Washington, DC", city: "Washington", state: "District of Columbia", country: "United States" },
  { display: "Philadelphia, PA", city: "Philadelphia", state: "Pennsylvania", country: "United States" },
  { display: "Nashville, TN", city: "Nashville", state: "Tennessee", country: "United States" },
  { display: "Raleigh, NC", city: "Raleigh", state: "North Carolina", country: "United States" },
  { display: "Salt Lake City, UT", city: "Salt Lake City", state: "Utah", country: "United States" },
  { display: "Detroit, MI", city: "Detroit", state: "Michigan", country: "United States" },
  { display: "Charlotte, NC", city: "Charlotte", state: "North Carolina", country: "United States" },
  { display: "San Jose, CA", city: "San Jose", state: "California", country: "United States" },
  { display: "Pittsburgh, PA", city: "Pittsburgh", state: "Pennsylvania", country: "United States" },
  { display: "Columbus, OH", city: "Columbus", state: "Ohio", country: "United States" },
  { display: "Remote", city: "", state: "", country: "United States" },
  // International locations
  { display: "Toronto, ON", city: "Toronto", state: "Ontario", country: "Canada" },
  { display: "Vancouver, BC", city: "Vancouver", state: "British Columbia", country: "Canada" },
  { display: "London, UK", city: "London", state: "England", country: "United Kingdom" },
  { display: "Berlin, DE", city: "Berlin", state: "Berlin", country: "Germany" },
  { display: "Bangalore, IN", city: "Bangalore", state: "Karnataka", country: "India" },
  { display: "Hyderabad, IN", city: "Hyderabad", state: "Telangana", country: "India" },
  { display: "Pune, IN", city: "Pune", state: "Maharashtra", country: "India" },
  { display: "Mumbai, IN", city: "Mumbai", state: "Maharashtra", country: "India" },
  { display: "Chennai, IN", city: "Chennai", state: "Tamil Nadu", country: "India" },
  { display: "Singapore", city: "Singapore", state: "", country: "Singapore" },
  { display: "Sydney, AU", city: "Sydney", state: "NSW", country: "Australia" },
  { display: "Dublin, IE", city: "Dublin", state: "Leinster", country: "Ireland" },
  { display: "Amsterdam, NL", city: "Amsterdam", state: "North Holland", country: "Netherlands" },
  { display: "Tel Aviv, IL", city: "Tel Aviv", state: "", country: "Israel" },
];

const JOB_TYPES: Array<"full_time" | "part_time" | "contract" | "internship"> = [
  "full_time", "full_time", "full_time", "full_time",      // 40 %
  "contract", "contract", "contract",                       // 30 %
  "part_time", "part_time",                                 // 20 %
  "internship",                                             // 10 %
];

const JOB_SUB_TYPES: Record<string, string[]> = {
  full_time:  ["w2", "c2h", "direct_hire", "salary"],
  contract:   ["c2c", "c2h", "1099", "w2"],
  part_time:  ["w2", "1099"],
  internship: ["paid", "unpaid"],
};

const WORK_MODES = ["remote", "remote", "onsite", "onsite", "hybrid", "hybrid", "hybrid", ""];

const SKILL_POOL = [
  // Languages
  "JavaScript", "TypeScript", "Python", "Java", "C#", "C++", "Go", "Rust", "Ruby",
  "Swift", "Kotlin", "Scala", "PHP", "R", "Dart", "Elixir", "Clojure", "Haskell",
  "Perl", "Lua", "MATLAB", "Objective-C", "Shell", "SQL", "Solidity",
  // Frontend
  "React", "Angular", "Vue.js", "Next.js", "Svelte", "Remix", "Astro", "Nuxt.js",
  "HTML5", "CSS3", "Sass", "Tailwind CSS", "Bootstrap", "Material UI", "Chakra UI",
  "Styled Components", "Storybook", "Redux", "Zustand", "MobX", "React Query",
  "Webpack", "Vite", "Rollup", "esbuild", "Turbopack",
  // Backend
  "Node.js", "Express", "NestJS", "Fastify", "Django", "Flask", "FastAPI",
  "Spring Boot", "ASP.NET", "Rails", "Laravel", "Phoenix",
  "GraphQL", "REST API", "gRPC", "tRPC", "WebSocket",
  // Data & ML
  "PostgreSQL", "MySQL", "MongoDB", "Redis", "Elasticsearch", "DynamoDB",
  "Cassandra", "Neo4j", "SQLite", "Prisma", "Mongoose", "Sequelize", "TypeORM",
  "TensorFlow", "PyTorch", "Scikit-learn", "Pandas", "NumPy", "Spark", "Kafka",
  "Airflow", "dbt", "Snowflake", "BigQuery", "Redshift",
  // Cloud & DevOps
  "AWS", "Azure", "GCP", "Docker", "Kubernetes", "Terraform", "Ansible",
  "Jenkins", "GitHub Actions", "GitLab CI", "CircleCI", "ArgoCD",
  "Prometheus", "Grafana", "Datadog", "New Relic", "ELK Stack",
  "Nginx", "Cloudflare", "Vercel", "Netlify", "Heroku",
  // Mobile
  "React Native", "Flutter", "SwiftUI", "Jetpack Compose", "Ionic",
  // Testing
  "Jest", "Cypress", "Playwright", "Selenium", "Mocha", "Vitest", "Testing Library",
  // Other
  "Figma", "Jira", "Confluence", "Agile", "Scrum", "CI/CD", "Microservices",
  "OAuth", "JWT", "OpenAPI", "Stripe API", "Twilio API",
];

const JOB_TITLES = [
  "Software Engineer", "Senior Software Engineer", "Staff Software Engineer",
  "Principal Engineer", "Software Architect", "Technical Lead",
  "Engineering Manager", "VP of Engineering", "CTO",
  "Frontend Developer", "Senior Frontend Developer", "Lead Frontend Engineer",
  "React Developer", "Angular Developer", "Vue.js Developer",
  "Backend Developer", "Senior Backend Developer", "Lead Backend Engineer",
  "Node.js Developer", "Python Developer", "Java Developer", "Go Developer",
  "Full Stack Developer", "Senior Full Stack Developer",
  "DevOps Engineer", "Senior DevOps Engineer", "SRE", "Platform Engineer",
  "Cloud Engineer", "Cloud Architect",
  "Data Engineer", "Senior Data Engineer", "Data Architect",
  "Data Analyst", "Senior Data Analyst", "Business Intelligence Analyst",
  "Data Scientist", "Senior Data Scientist", "ML Engineer", "AI Engineer",
  "QA Engineer", "Senior QA Engineer", "SDET", "QA Lead",
  "Mobile Developer", "iOS Developer", "Android Developer",
  "React Native Developer", "Flutter Developer",
  "Security Engineer", "Cybersecurity Analyst",
  "Product Manager", "Technical Product Manager",
  "Scrum Master", "Agile Coach",
  "Solutions Architect", "Technical Consultant",
  "UI/UX Designer", "UX Researcher",
  "Technical Writer", "Developer Advocate",
  "Database Administrator", "Systems Administrator",
  "Network Engineer", "Embedded Systems Engineer",
  "Blockchain Developer", "Web3 Engineer",
  "Game Developer", "Graphics Engineer",
];

const JOB_DESC_TEMPLATES = [
  "We are looking for a {title} to join our team. You will work on {skill1}, {skill2}, and {skill3} in a fast-paced environment. Experience building scalable, production-grade systems is a plus.",
  "Join our engineering team as a {title}! Ideal candidates have strong experience in {skill1} and {skill2}. You'll collaborate with cross-functional teams to deliver features enjoyed by millions.",
  "Exciting opportunity for a {title} with hands-on experience in {skill1}, {skill2}, and {skill3}. You'll play a key role in designing and implementing new features from the ground up.",
  "We're hiring a passionate {title} who thrives in a collaborative setting. Must-haves: {skill1} and {skill2}. Nice-to-haves: {skill3}. Competitive comp and great benefits package included.",
  "As a {title}, you'll design, build, and maintain high-performance systems using {skill1} and {skill2}. You'll mentor junior engineers and help shape engineering culture.",
  "We need a talented {title} who is comfortable with {skill1} and {skill2}. You'll own end-to-end delivery of key product features in an agile environment using {skill3}.",
  "Looking for a results-oriented {title} with deep expertise in {skill1}. You'll lead initiatives in {skill2} and {skill3}. Remote-friendly — work from anywhere in the US.",
  "Our growing team needs a {title}. Key responsibilities include building microservices with {skill1}, integrating {skill2}, and optimizing {skill3} pipelines for scale.",
];

const COMPANIES = [
  "Google", "Meta", "Amazon", "Apple", "Microsoft", "Netflix", "Uber", "Lyft",
  "Airbnb", "DoorDash", "Shopify", "Twilio", "Atlassian", "Slack", "Zoom",
  "Snowflake", "Databricks", "Figma", "Notion", "Linear", "Vercel", "Supabase",
  "Cloudflare", "DigitalOcean", "HashiCorp", "MongoDB Inc", "Elastic", "Confluent",
  "Palantir", "Coinbase", "Robinhood", "Square", "Plaid", "Brex", "Ripple",
  "OpenAI", "Anthropic", "Cohere", "Hugging Face", "Scale AI", "DataRobot", "C3.ai",
  "UiPath", "Infosys", "TCS", "Wipro", "Cognizant", "Accenture", "Deloitte",
  "Capgemini", "IBM", "Oracle", "SAP", "Salesforce", "Adobe", "VMware",
  "Dell Technologies", "Qualcomm", "NVIDIA", "AMD", "Intel", "Cisco",
  "PayPal", "Stripe", "Visa", "Mastercard", "Goldman Sachs", "JPMorgan Chase",
  "Capital One", "Fidelity", "Bloomberg", "Citadel", "Two Sigma",
  "SpaceX", "Tesla", "Rivian", "Boeing", "Lockheed Martin",
  "Epic Games", "Riot Games", "Electronic Arts", "Unity", "Roblox",
  "Spotify", "Pinterest", "Snap", "Twitter/X", "Reddit", "Discord",
  "Instacart", "Grubhub", "Zillow", "Redfin", "Wayfair",
  "Workday", "ServiceNow", "Palo Alto Networks", "CrowdStrike", "Okta",
  "Datadog", "Splunk", "New Relic", "Dynatrace", "Zscaler",
  "HubSpot", "Zendesk", "Freshworks", "Twitch", "Dropbox",
  "Airtable", "Monday.com", "Asana", "Canva", "Miro",
];

const ROLES = [
  "Software Engineer", "Senior Developer", "Lead Engineer", "Staff Engineer",
  "Principal Engineer", "Architect", "Engineering Manager", "Tech Lead",
  "Full Stack Developer", "Frontend Developer", "Backend Developer",
  "DevOps Engineer", "QA Engineer", "Data Analyst", "Data Scientist",
  "ML Engineer", "SRE", "Product Manager", "Scrum Master", "Project Manager",
  "Business Analyst", "UI Designer", "UX Researcher", "Solutions Consultant",
  "Technical Writer", "Cloud Engineer", "Mobile Developer", "Security Engineer",
  "Database Administrator", "Platform Engineer",
];

const FIRST_NAMES = [
  "Aarav", "Aditi", "Adrian", "Aisha", "Akira", "Alejandro", "Alex", "Amara",
  "Amit", "Ana", "Andrea", "Angela", "Anita", "Arjun", "Benjamin", "Brandon",
  "Carlos", "Chen", "Chris", "Clara", "Daniel", "David", "Deepak", "Diana",
  "Elena", "Emily", "Erik", "Fatima", "Gabriela", "Gaurav", "Grace", "Hana",
  "Hannah", "Harsha", "Ibrahim", "Isha", "James", "Jasmine", "Jason", "Jaya",
  "Jennifer", "Jessica", "John", "Jordan", "Joshua", "Julia", "Karen", "Kavya",
  "Kevin", "Lakshmi", "Laura", "Leo", "Li", "Lily", "Lucas", "Luisa",
  "Marcus", "Maria", "Mei", "Melissa", "Michael", "Mohammed", "Nadia", "Nathan",
  "Neha", "Olga", "Omar", "Patricia", "Paul", "Priya", "Rachel", "Raj",
  "Rebecca", "Ricardo", "Robert", "Rosa", "Roshan", "Ryan", "Sakura", "Sam",
  "Sandra", "Sara", "Sasha", "Sean", "Shreya", "Sofia", "Sonia", "Sophia",
  "Stefan", "Sunita", "Tanya", "Tariq", "Thomas", "Uma", "Victor", "Victoria",
  "Vikram", "Wei", "William", "Xin", "Yuki", "Zara", "Zoe", "Aditya",
  "Alina", "Anthony", "Blake", "Cameron", "Chloe", "Connor",
  "Dylan", "Ella", "Ethan", "Finn", "Harper", "Isabella",
  "Jack", "Kai", "Liam", "Luna", "Mason", "Mia",
  "Noah", "Olivia", "Owen", "Quinn", "Riley", "Theo",
];

const LAST_NAMES = [
  "Agarwal", "Alvarez", "Anderson", "Banerjee", "Brown", "Chakraborty",
  "Chang", "Chen", "Chowdhury", "Clark", "Das", "Davis", "Desai", "Diaz",
  "Dubois", "Evans", "Fernandez", "Garcia", "Gonzalez", "Gupta", "Hall",
  "Harris", "Hernandez", "Huang", "Iyer", "Jackson", "Jain", "Jha",
  "Johnson", "Jones", "Kapoor", "Kim", "Kumar", "Lee", "Li",
  "Lopez", "Martinez", "Mehta", "Miller", "Mishra", "Moore", "Mukherjee",
  "Nair", "Nakamura", "Nguyen", "O'Brien", "Patel", "Perez", "Prasad",
  "Rao", "Reddy", "Robinson", "Rodriguez", "Sato", "Schneider", "Shah",
  "Sharma", "Singh", "Smith", "Srinivasan", "Taylor", "Thomas", "Thompson",
  "Tran", "Verma", "Wang", "White", "Williams", "Wilson", "Wu",
  "Xu", "Yang", "Zhang", "Zhou", "Adams", "Baker", "Carter", "Cooper",
  "Foster", "Green", "Hill", "Howard", "James", "King", "Lewis",
  "Martin", "Mitchell", "Morgan", "Murphy", "Nelson", "Owens",
  "Parker", "Phillips", "Reed", "Richardson", "Roberts", "Scott",
  "Stewart", "Sullivan", "Turner", "Walker", "Ward", "Wright", "Young",
];

const BIOS = [
  "Passionate software engineer with {exp} years of experience building scalable applications. Strong background in {skill1} and {skill2}.",
  "Results-driven developer specializing in {skill1} and {skill2}. Love solving complex problems and mentoring junior engineers.",
  "Full-stack developer with expertise in {skill1}, {skill2}, and cloud technologies. {exp} years in the industry.",
  "Detail-oriented engineer focused on code quality, performance, and user experience. Proficient in {skill1} and {skill2}.",
  "Experienced professional with a proven track record in {skill1} and {skill2}. Worked on products used by millions of users.",
  "Creative problem-solver with {exp} years in software development. Deep knowledge of {skill1} and {skill2}.",
  "Dedicated {role} building reliable, scalable systems. Core strengths: {skill1}, {skill2}, and agile practices.",
  "Tech enthusiast with hands-on expertise in {skill1} and {skill2}. Passionate about open source and continuous learning.",
];

const UNIVERSITIES = [
  "MIT", "Stanford", "UC Berkeley", "Georgia Tech", "CMU", "Caltech",
  "U of Michigan", "UT Austin", "U of Washington", "Cornell", "Princeton",
  "Harvard", "Yale", "Columbia", "U of Illinois", "Purdue", "Virginia Tech",
  "U of Maryland", "UNC Chapel Hill", "UCLA",
  "U of Toronto", "U of Waterloo", "UBC",
  "Oxford", "Cambridge", "Imperial College London", "ETH Zurich",
  "IIT Bombay", "IIT Delhi", "IIT Madras", "NIT Trichy", "BITS Pilani",
  "NUS Singapore", "NTU Singapore", "U of Melbourne", "U of Sydney",
  "Technion", "KAIST", "Tsinghua", "Peking University",
];

const DEGREE_FIELDS = [
  "Computer Science", "Software Engineering", "Information Technology",
  "Data Science", "Mathematics", "Electrical Engineering",
  "Computer Engineering", "Information Systems", "Statistics",
  "Applied Mathematics", "Physics", "Mechanical Engineering",
];

const VISIBILITY_CONFIGS: Record<string, string[]>[] = [
  { full_time: ["w2", "c2h"], contract: ["c2c"] },
  { full_time: ["w2"], contract: ["c2c", "c2h"] },
  { full_time: [], contract: [] },
  { contract: ["c2c", "1099"] },
  { full_time: ["w2", "direct_hire"], part_time: ["w2"] },
  { full_time: ["salary"], contract: ["w2"] },
  { full_time: ["c2h"], part_time: ["1099"] },
  { contract: [] },
  {},
  { full_time: ["w2", "c2h", "direct_hire", "salary"], contract: ["c2c", "c2h", "1099", "w2"], part_time: ["w2", "1099"] },
];

const COVER_LETTERS = [
  "I am very interested in this position and believe my experience with {skill1} and {skill2} makes me a strong candidate.",
  "With {exp} years of hands-on experience, I am confident I can add value to your team. My expertise in {skill1} aligns perfectly.",
  "I'm excited about this opportunity! My background in {skill1} and {skill2}, combined with my passion for clean code, make me an ideal fit.",
  "This role caught my attention because of its focus on {skill1}. I have extensive experience and would love to contribute.",
  "As a {role} with {exp} years of experience, I've built solutions using {skill1} and {skill2}. I'd love to join your team.",
];

const POKE_SUBJECTS = [
  "Interested in your profile!",
  "Great match for our open position",
  "Let's connect about a job opportunity",
  "Your skills are a perfect fit!",
  "Exciting opportunity — would love to chat",
  "Regarding the {title} position",
  "Quick question about your availability",
  "Following up on your application",
  "We'd love to have you on our team",
  "Your experience caught my eye",
];

const APP_STATUSES: Array<"pending" | "reviewing" | "shortlisted" | "rejected" | "hired"> = [
  "pending", "pending", "pending",
  "reviewing", "reviewing",
  "shortlisted",
  "rejected",
  "hired",
];

/* ═══════════════════════════════════════════════════════════════════
   Build 10 000 Jobs
   ═══════════════════════════════════════════════════════════════════ */

function buildJobs(): any[] {
  const jobs: any[] = [];
  for (let i = 0; i < 10_000; i++) {
    const vendor = pick(VENDORS);
    const title = pick(JOB_TITLES);
    const jobType = pick(JOB_TYPES);
    const subType = pick(JOB_SUB_TYPES[jobType]);
    const workMode = pick(WORK_MODES);
    const skills = pickN(SKILL_POOL, randInt(3, 8));
    const exp = randInt(0, 15);
    const baseRate = randInt(25, 150);
    const loc = pick(LOCATIONS);

    const desc = pick(JOB_DESC_TEMPLATES)
      .replace("{title}", title)
      .replace("{skill1}", skills[0] || "JavaScript")
      .replace("{skill2}", skills[1] || "TypeScript")
      .replace("{skill3}", skills[2] || "React");

    const isActive = Math.random() > 0.12; // ~88 % active
    const createdAt = randDate(365);

    jobs.push({
      title,
      description: desc,
      vendorId: vendor.id,
      vendorEmail: vendor.email,
      recruiterName: vendor.name,
      recruiterPhone: vendor.phone,
      location: loc.display,
      jobCountry: loc.country,
      jobState: loc.state,
      jobCity: loc.city,
      jobType,
      jobSubType: subType,
      workMode,
      salaryMin: baseRate * 2000,
      salaryMax: baseRate * 2000 + randInt(10_000, 50_000),
      payPerHour: baseRate,
      skillsRequired: skills,
      experienceRequired: exp,
      isActive,
      createdAt,
      updatedAt: createdAt,
    });
  }
  return jobs;
}

/* ═══════════════════════════════════════════════════════════════════
   Build 10 000 Candidate Profiles
   ═══════════════════════════════════════════════════════════════════ */

function buildCandidates(): any[] {
  const profiles: any[] = [];

  for (let i = 0; i < 10_000; i++) {
    const firstName = pick(FIRST_NAMES);
    const lastName = pick(LAST_NAMES);
    const fullName = `${firstName} ${lastName}`;
    const id = randomUUID();
    const skills = pickN(SKILL_POOL, randInt(3, 12));
    const exp = randInt(0, 25);
    const role = pick(ROLES);
    const vis = pick(VISIBILITY_CONFIGS);
    const loc = pick(LOCATIONS);

    const bio = pick(BIOS)
      .replace("{exp}", String(exp))
      .replace("{skill1}", skills[0])
      .replace("{skill2}", skills[1] || skills[0])
      .replace("{role}", role);

    const numPrevRoles = exp > 8 ? 3 : exp > 3 ? 2 : 1;
    const resumeExpLines: string[] = [];
    for (let r = 0; r < numPrevRoles; r++) {
      resumeExpLines.push(`• ${pick(COMPANIES)} — ${pick(ROLES)} (${randInt(1, 5)} years)`);
    }

    profiles.push({
      candidateId: id,
      username: `${firstName.toLowerCase()}-${lastName.toLowerCase()}-${id.slice(0, 6)}`,
      name: fullName,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}+${id.slice(0, 4)}@example.com`,
      phone: `+1-555-${String(randInt(1000, 9999))}`,
      currentCompany: pick(COMPANIES),
      currentRole: role,
      preferredJobType: pick(["full_time", "full_time", "contract", "contract", "part_time"]),
      expectedHourlyRate: randInt(20, 200),
      experienceYears: exp,
      skills,
      location: loc.display,
      profileCountry: loc.country,
      bio,
      resumeSummary: `${role} with ${exp} years of professional experience specializing in ${skills.slice(0, 3).join(", ")}. Passionate about building impactful products.`,
      resumeExperience: resumeExpLines.join("\n"),
      resumeEducation:
        exp > 2
          ? `B.S. ${pick(DEGREE_FIELDS)}, ${pick(UNIVERSITIES)} (${2026 - exp - randInt(0, 4)})`
          : `Currently pursuing degree in ${pick(DEGREE_FIELDS)}`,
      resumeAchievements: `• ${pick(["Developed", "Architected", "Led", "Designed", "Built"])} ${pick(["a real-time analytics platform", "a distributed payments system", "an ML-powered recommendation engine", "a CI/CD pipeline", "a microservices migration", "a cross-platform mobile app"])}\n• ${pick(["Improved", "Reduced", "Optimized", "Enhanced"])} ${pick(["system throughput", "API latency", "deployment frequency", "test coverage", "code review turnaround"])} by ${randInt(20, 80)}%`,
      profileLocked: Math.random() > 0.25,
      visibilityConfig: vis,
      createdAt: randDate(365),
    });
  }

  return profiles;
}

/* ═══════════════════════════════════════════════════════════════════
   Build ~5 000 Applications
   ═══════════════════════════════════════════════════════════════════ */

function buildApplications(jobIds: string[], jobTitles: string[], candIds: string[], candEmails: string[], candSkills: string[][], candExp: number[], candRoles: string[]): any[] {
  const apps: any[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < 6_000 && apps.length < 5_000; i++) {
    const jIdx = randInt(0, jobIds.length - 1);
    const cIdx = randInt(0, candIds.length - 1);
    const key = `${jobIds[jIdx]}-${candIds[cIdx]}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const skills = candSkills[cIdx] || [];
    const coverLetter = pick(COVER_LETTERS)
      .replace("{skill1}", skills[0] || "my core skills")
      .replace("{skill2}", skills[1] || "modern technologies")
      .replace("{exp}", String(candExp[cIdx] || 3))
      .replace("{role}", candRoles[cIdx] || "developer");

    apps.push({
      jobId: jobIds[jIdx],
      jobTitle: jobTitles[jIdx],
      candidateId: candIds[cIdx],
      candidateEmail: candEmails[cIdx],
      coverLetter,
      status: pick(APP_STATUSES),
      createdAt: randDate(120),
    });
  }

  return apps;
}

/* ═══════════════════════════════════════════════════════════════════
   Build ~2 000 Poke Records
   ═══════════════════════════════════════════════════════════════════ */

function buildPokeRecords(
  jobIds: string[], jobTitles: string[], jobVendorIds: string[],
  candIds: string[], candEmails: string[], candNames: string[],
): any[] {
  const records: any[] = [];
  const seen = new Set<string>();

  // 1000 vendor→candidate pokes
  for (let i = 0; i < 1_200 && records.length < 1_000; i++) {
    const vendor = pick(VENDORS);
    const cIdx = randInt(0, candIds.length - 1);
    const jIdx = randInt(0, jobIds.length - 1);
    const isEmail = Math.random() > 0.5;
    const key = `v-${vendor.id}-${candIds[cIdx]}-${isEmail ? 1 : 0}`;
    if (seen.has(key)) continue;
    seen.add(key);

    records.push({
      senderId: vendor.id,
      senderName: vendor.name,
      senderEmail: vendor.email,
      senderType: "vendor",
      targetId: candIds[cIdx],
      targetEmail: candEmails[cIdx],
      targetName: candNames[cIdx],
      subject: pick(POKE_SUBJECTS).replace("{title}", jobTitles[jIdx]),
      isEmail,
      jobId: jobIds[jIdx],
      jobTitle: jobTitles[jIdx],
      createdAt: randDate(90),
    });
  }

  // 1000 candidate→vendor pokes
  for (let i = 0; i < 1_200 && records.length < 2_000; i++) {
    const cIdx = randInt(0, candIds.length - 1);
    const jIdx = randInt(0, jobIds.length - 1);
    const isEmail = Math.random() > 0.5;
    const key = `c-${candIds[cIdx]}-${jobIds[jIdx]}-${isEmail ? 1 : 0}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const vendorIdx = VENDORS.findIndex(v => v.id === jobVendorIds[jIdx]);
    const vendor = vendorIdx >= 0 ? VENDORS[vendorIdx] : pick(VENDORS);

    records.push({
      senderId: candIds[cIdx],
      senderName: candNames[cIdx],
      senderEmail: candEmails[cIdx],
      senderType: "candidate",
      targetId: jobIds[jIdx],
      targetVendorId: jobVendorIds[jIdx],
      targetEmail: vendor.email,
      targetName: vendor.name,
      subject: pick(POKE_SUBJECTS).replace("{title}", jobTitles[jIdx]),
      isEmail,
      jobId: jobIds[jIdx],
      jobTitle: jobTitles[jIdx],
      createdAt: randDate(90),
    });
  }

  return records;
}

/* ═══════════════════════════════════════════════════════════════════
   Main
   ═══════════════════════════════════════════════════════════════════ */

async function main() {
  console.log("Connecting to MongoDB…");
  await mongoose.connect(`${MONGO_URI}/${MONGO_DB}`);
  console.log("✅ MongoDB connected\n");

  // Clear existing data
  console.log("🗑  Clearing existing data…");
  await Promise.all([
    JobModel.deleteMany({}),
    ProfileModel.deleteMany({}),
    AppModel.deleteMany({}),
    PokeRecordModel.deleteMany({}),
    PokeLogModel.deleteMany({}),
  ]);
  console.log("   Done.\n");

  // ── 1) Jobs ──
  console.log("📋 Building 10,000 jobs…");
  const jobData = buildJobs();
  console.log("   Inserting…");
  await batchInsert(JobModel, jobData, "Jobs");

  // Fetch inserted job IDs
  const jobDocs = await JobModel.find({}, { _id: 1, title: 1, vendorId: 1 }).lean();
  const jobIds = jobDocs.map((j: any) => j._id.toString());
  const jobTitles = jobDocs.map((j: any) => j.title);
  const jobVendorIds = jobDocs.map((j: any) => j.vendorId);
  console.log(`   → ${jobDocs.length} jobs in DB\n`);

  // ── 2) Candidate Profiles ──
  console.log("👤 Building 10,000 candidate profiles…");
  const candData = buildCandidates();
  console.log("   Inserting…");
  await batchInsert(ProfileModel, candData, "Profiles");

  const candDocs = await ProfileModel.find(
    {},
    { _id: 0, candidateId: 1, email: 1, name: 1, skills: 1, experienceYears: 1, currentRole: 1 },
  ).lean();
  const candIds = candDocs.map((c: any) => c.candidateId);
  const candEmails = candDocs.map((c: any) => c.email);
  const candNames = candDocs.map((c: any) => c.name);
  const candSkills = candDocs.map((c: any) => c.skills);
  const candExp = candDocs.map((c: any) => c.experienceYears);
  const candRoles = candDocs.map((c: any) => c.currentRole);
  console.log(`   → ${candDocs.length} profiles in DB\n`);

  // ── 3) Applications ──
  console.log("📝 Building ~5,000 applications…");
  const appData = buildApplications(jobIds, jobTitles, candIds, candEmails, candSkills, candExp, candRoles);
  console.log("   Inserting…");
  await batchInsert(AppModel, appData, "Applications");
  console.log(`   → ${appData.length} applications created\n`);

  // ── 4) Poke Records ──
  console.log("⚡ Building ~2,000 poke records…");
  const pokeData = buildPokeRecords(jobIds, jobTitles, jobVendorIds, candIds, candEmails, candNames);
  console.log("   Inserting…");
  await batchInsert(PokeRecordModel, pokeData, "Poke records");
  console.log(`   → ${pokeData.length} poke records created\n`);

  // ── 5) Poke Logs ──
  console.log("📊 Seeding poke logs…");
  const logEntries: any[] = [];
  const yearMonth = "2026-02";
  for (let i = 0; i < 50; i++) {
    logEntries.push({ userId: candIds[i], yearMonth, count: randInt(1, 20) });
  }
  for (const v of VENDORS) {
    logEntries.push({ userId: v.id, yearMonth, count: randInt(1, 40) });
  }
  await PokeLogModel.insertMany(logEntries);
  console.log(`   → ${logEntries.length} poke log entries\n`);

  // ── Summary ──
  const totalJobs = await JobModel.countDocuments();
  const activeJobs = await JobModel.countDocuments({ isActive: true });
  const totalProfiles = await ProfileModel.countDocuments();
  const totalApps = await AppModel.countDocuments();
  const totalPokes = await PokeRecordModel.countDocuments();
  const totalLogs = await PokeLogModel.countDocuments();

  console.log("═══════════════════════════════════════════════");
  console.log("  SEED 10K SUMMARY");
  console.log("═══════════════════════════════════════════════");
  console.log(`  Jobs:            ${totalJobs}  (${activeJobs} active)`);
  console.log(`  Candidates:      ${totalProfiles}`);
  console.log(`  Applications:    ${totalApps}`);
  console.log(`  Poke Records:    ${totalPokes}`);
  console.log(`  Poke Logs:       ${totalLogs}`);
  console.log("═══════════════════════════════════════════════");
  console.log("\n✅ Done! 10k seed data is ready.");

  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
