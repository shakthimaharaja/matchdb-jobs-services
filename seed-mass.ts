/**
 * Mass-seed script — generates large-scale test data for pagination + performance testing.
 *
 * Creates:
 *   • 150 Jobs         (all types, subtypes, work modes, vendors, active/inactive mix)
 *   • 80  Candidates   (diverse skills, experience, locations, visibility configs)
 *   • 200 Applications (various statuses)
 *   • 120 Poke Records (mix of pokes & emails, vendor→candidate & candidate→vendor)
 *
 * Run:  npx tsx seed-mass.ts
 */
import mongoose, { Schema } from "mongoose";
import { randomUUID } from "crypto";

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017";
const MONGO_DB = process.env.MONGO_DB_NAME || "matchdb_jobs";

/* ─── Schemas (standalone — no import from src so script can run independently) ─── */

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
      jobType: String,
      jobSubType: { type: String, default: "" },
      workMode: { type: String, default: "" },
      salaryMin: Number,
      salaryMax: Number,
      payPerHour: Number,
      skillsRequired: [String],
      experienceRequired: Number,
      isActive: { type: Boolean, default: true },
    },
    { timestamps: true, collection: "jobs" },
  ),
);

const ProfileModel = mongoose.model(
  "CandidateProfile",
  new Schema(
    {
      candidateId: String,
      username: { type: String, default: "" },
      name: String,
      email: String,
      phone: String,
      currentCompany: String,
      currentRole: String,
      preferredJobType: String,
      expectedHourlyRate: Number,
      experienceYears: Number,
      skills: [String],
      location: String,
      bio: String,
      resumeSummary: { type: String, default: "" },
      resumeExperience: { type: String, default: "" },
      resumeEducation: { type: String, default: "" },
      resumeAchievements: { type: String, default: "" },
      profileLocked: { type: Boolean, default: false },
      visibilityConfig: { type: Schema.Types.Mixed, default: {} },
    },
    { timestamps: true, collection: "candidateprofiles" },
  ),
);

const AppModel = mongoose.model(
  "Application",
  new Schema(
    {
      jobId: String,
      jobTitle: String,
      candidateId: String,
      candidateEmail: String,
      coverLetter: String,
      status: { type: String, default: "pending" },
    },
    { timestamps: true, collection: "applications" },
  ),
);

const PokeRecordModel = mongoose.model(
  "PokeRecord",
  new Schema(
    {
      senderId: String,
      senderName: String,
      senderEmail: String,
      senderType: { type: String, enum: ["vendor", "candidate"] },
      targetId: String,
      targetVendorId: String,
      targetEmail: String,
      targetName: String,
      subject: String,
      isEmail: { type: Boolean, default: false },
      jobId: String,
      jobTitle: String,
    },
    { timestamps: true, collection: "pokerecords" },
  ),
);

const PokeLogModel = mongoose.model(
  "PokeLog",
  new Schema(
    {
      userId: String,
      yearMonth: String,
      count: { type: Number, default: 0 },
    },
    { timestamps: true, collection: "pokelogs" },
  ),
);

/* ─── Helpers ─── */

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function pickN<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function randDate(daysBack: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - Math.floor(Math.random() * daysBack));
  d.setHours(randInt(0, 23), randInt(0, 59), randInt(0, 59));
  return d;
}

/* ─── Vendor Data (7 known + 8 new = 15 vendors) ─── */

const VENDORS = [
  // Existing (from shell-services seed)
  {
    id: "d8c0acdc-07f4-4f4e-9b71-5e0f6d0f1745",
    name: "Dan Brown",
    email: "dan@techcorp.com",
    company: "TechCorp",
    phone: "+1-555-0101",
  },
  {
    id: "b25adc3b-d440-470f-9390-54794dd95f89",
    name: "Eve Williams",
    email: "eve@cloudops.io",
    company: "CloudOps",
    phone: "+1-555-0201",
  },
  {
    id: "379a35d5-c33b-46ec-8c7a-79ec54d4378b",
    name: "Frank Lee",
    email: "frank@devhire.com",
    company: "DevHire",
    phone: "+1-555-0301",
  },
  {
    id: "a1b2c3d4-2222-4bbb-b222-000000000001",
    name: "Nina Patel",
    email: "nina@staffplus.com",
    company: "StaffPlus",
    phone: "+1-555-0401",
  },
  {
    id: "a1b2c3d4-2222-4bbb-b222-000000000002",
    name: "Oscar Grant",
    email: "oscar@talentbridge.com",
    company: "TalentBridge",
    phone: "+1-555-0501",
  },
  {
    id: "a1b2c3d4-2222-4bbb-b222-000000000003",
    name: "Paula Kim",
    email: "paula@nexgen.io",
    company: "NexGen",
    phone: "+1-555-0601",
  },
  {
    id: "a1b2c3d4-2222-4bbb-b222-000000000004",
    name: "Quinn Torres",
    email: "quinn@apexhr.com",
    company: "ApexHR",
    phone: "+1-555-0701",
  },
  // New vendors
  {
    id: randomUUID(),
    name: "Rachel Hayes",
    email: "rachel@dataworksinc.com",
    company: "DataWorks Inc",
    phone: "+1-555-0801",
  },
  {
    id: randomUUID(),
    name: "Steve Nguyen",
    email: "steve@codeforge.dev",
    company: "CodeForge",
    phone: "+1-555-0901",
  },
  {
    id: randomUUID(),
    name: "Tina Martinez",
    email: "tina@primetalent.com",
    company: "PrimeTalent",
    phone: "+1-555-1001",
  },
  {
    id: randomUUID(),
    name: "Umar Shah",
    email: "umar@stackbridge.io",
    company: "StackBridge",
    phone: "+1-555-1101",
  },
  {
    id: randomUUID(),
    name: "Vera Johansson",
    email: "vera@nordictech.se",
    company: "NordicTech",
    phone: "+1-555-1201",
  },
  {
    id: randomUUID(),
    name: "Will Chen",
    email: "will@infinityhire.com",
    company: "InfinityHire",
    phone: "+1-555-1301",
  },
  {
    id: randomUUID(),
    name: "Xena Dimitri",
    email: "xena@eliterecruit.co",
    company: "EliteRecruit",
    phone: "+1-555-1401",
  },
  {
    id: randomUUID(),
    name: "Yash Agarwal",
    email: "yash@techtitans.in",
    company: "TechTitans",
    phone: "+1-555-1501",
  },
];

/* ─── Candidate Data (10 known + 70 new = 80 candidates) ─── */

const KNOWN_CANDIDATES = [
  {
    id: "3458c125-290a-4d47-ac8a-c151f7241ec6",
    name: "Alice Johnson",
    email: "alice@example.com",
  },
  {
    id: "b444f8a3-a43c-44dc-be78-9c400e4c395a",
    name: "Bob Smith",
    email: "bob@example.com",
  },
  {
    id: "3f7616df-ebff-4b2b-b0b9-b9b5d539593f",
    name: "Carol Davis",
    email: "carol@example.com",
  },
  {
    id: "a1b2c3d4-1111-4aaa-b111-000000000001",
    name: "Grace Park",
    email: "grace@example.com",
  },
  {
    id: "a1b2c3d4-1111-4aaa-b111-000000000002",
    name: "Hank Miller",
    email: "hank@example.com",
  },
  {
    id: "a1b2c3d4-1111-4aaa-b111-000000000003",
    name: "Irene Costa",
    email: "irene@example.com",
  },
  {
    id: "a1b2c3d4-1111-4aaa-b111-000000000004",
    name: "Jack Wilson",
    email: "jack@example.com",
  },
  {
    id: "a1b2c3d4-1111-4aaa-b111-000000000005",
    name: "Karen White",
    email: "karen@example.com",
  },
  {
    id: "a1b2c3d4-1111-4aaa-b111-000000000006",
    name: "Leo Chang",
    email: "leo@example.com",
  },
  {
    id: "a1b2c3d4-1111-4aaa-b111-000000000007",
    name: "Mia Thompson",
    email: "mia@example.com",
  },
];

const FIRST_NAMES = [
  "Aarav",
  "Aisha",
  "Ananya",
  "Arjun",
  "Ben",
  "Caleb",
  "Chloe",
  "Darius",
  "Diana",
  "Elias",
  "Emily",
  "Ethan",
  "Fatima",
  "Felix",
  "Gina",
  "Hassan",
  "Isla",
  "James",
  "Julia",
  "Kai",
  "Lara",
  "Logan",
  "Luna",
  "Marcus",
  "Nadia",
  "Noah",
  "Olivia",
  "Omar",
  "Priya",
  "Raj",
  "Ruby",
  "Ryan",
  "Sahil",
  "Sara",
  "Soren",
  "Tanya",
  "Uma",
  "Victor",
  "Wei",
  "Yuki",
  "Zara",
  "Amit",
  "Belen",
  "Carlos",
  "Deepa",
  "Erik",
  "Fiona",
  "George",
  "Hema",
  "Ivan",
  "Jenny",
  "Kevin",
  "Lily",
  "Maya",
  "Nathan",
  "Orna",
  "Peng",
  "Qasim",
  "Rosa",
  "Sam",
  "Tara",
  "Uri",
  "Vince",
  "Wendy",
  "Xiomara",
  "Yolanda",
  "Zach",
  "Aditya",
  "Brianna",
  "Cruz",
];
const LAST_NAMES = [
  "Anderson",
  "Baker",
  "Chen",
  "Desai",
  "Edwards",
  "Fischer",
  "Garcia",
  "Hernandez",
  "Ivanov",
  "Jones",
  "Kumar",
  "Lopez",
  "Mitchell",
  "Nakamura",
  "O'Brien",
  "Patel",
  "Quinn",
  "Rodriguez",
  "Sharma",
  "Taylor",
  "Upadhyay",
  "Vasquez",
  "Wang",
  "Xu",
  "Yamamoto",
  "Zhang",
  "Ali",
  "Berg",
  "Cruz",
  "Diaz",
  "Eriksson",
  "Foster",
  "Gupta",
  "Huang",
  "Ibrahim",
  "Johal",
  "Kim",
  "Li",
  "Mehta",
  "Nair",
  "Okafor",
  "Park",
  "Rao",
  "Singh",
  "Tanaka",
  "Uysal",
  "Volkov",
  "Wu",
  "Yang",
  "Zhao",
  "Chopra",
  "Dutta",
  "Fernandez",
  "Gonzalez",
  "Hsu",
  "Ito",
  "Joshi",
  "Kapoor",
  "Lee",
  "Morales",
  "Nguyen",
  "Ortiz",
  "Pham",
  "Reddy",
  "Sato",
  "Thakur",
  "Verma",
  "Wei",
  "Yadav",
  "Zhu",
];

/* ─── Job Template Pools ─── */

const JOB_TYPES: Array<"full_time" | "part_time" | "contract" | "internship"> =
  [
    "full_time",
    "full_time",
    "full_time", // weighted
    "contract",
    "contract",
    "part_time",
    "internship",
  ];
const JOB_SUB_TYPES: Record<string, string[]> = {
  full_time: ["w2", "c2h", "direct_hire", "salary", ""],
  part_time: ["w2", "1099", ""],
  contract: ["c2c", "c2h", "1099", "w2", ""],
  internship: ["", "w2"],
};
const WORK_MODES: Array<"remote" | "onsite" | "hybrid" | ""> = [
  "remote",
  "onsite",
  "hybrid",
  "remote",
  "hybrid",
  "",
];

const LOCATIONS = [
  "Austin, TX",
  "New York, NY",
  "San Francisco, CA",
  "Seattle, WA",
  "Chicago, IL",
  "Denver, CO",
  "Miami, FL",
  "Atlanta, GA",
  "Boston, MA",
  "Los Angeles, CA",
  "Dallas, TX",
  "Portland, OR",
  "Phoenix, AZ",
  "Raleigh, NC",
  "Minneapolis, MN",
  "Remote",
  "Nashville, TN",
  "San Diego, CA",
  "Charlotte, NC",
  "Tampa, FL",
  "Salt Lake City, UT",
  "Columbus, OH",
  "Detroit, MI",
  "Philadelphia, PA",
  "Washington, DC",
  "Pittsburgh, PA",
  "Indianapolis, IN",
  "Las Vegas, NV",
  "San Jose, CA",
  "Orlando, FL",
];

const SKILL_POOL = [
  "JavaScript",
  "TypeScript",
  "React",
  "Angular",
  "Vue.js",
  "Next.js",
  "Node.js",
  "Express",
  "Python",
  "Django",
  "Flask",
  "FastAPI",
  "Java",
  "Spring Boot",
  "Kotlin",
  "Go",
  "Rust",
  "C#",
  ".NET",
  "Ruby",
  "Rails",
  "PHP",
  "Laravel",
  "Swift",
  "Objective-C",
  "React Native",
  "Flutter",
  "Dart",
  "SQL",
  "PostgreSQL",
  "MySQL",
  "MongoDB",
  "Redis",
  "Elasticsearch",
  "GraphQL",
  "REST API",
  "gRPC",
  "AWS",
  "Azure",
  "GCP",
  "Docker",
  "Kubernetes",
  "Terraform",
  "Jenkins",
  "GitHub Actions",
  "CI/CD",
  "Linux",
  "Bash",
  "PowerShell",
  "Ansible",
  "Puppet",
  "Datadog",
  "Splunk",
  "Prometheus",
  "Grafana",
  "Kafka",
  "RabbitMQ",
  "Apache Spark",
  "Hadoop",
  "Snowflake",
  "dbt",
  "Airflow",
  "Tableau",
  "Power BI",
  "Figma",
  "Sketch",
  "TensorFlow",
  "PyTorch",
  "scikit-learn",
  "NLP",
  "Computer Vision",
  "LLMs",
  "LangChain",
  "OpenAI API",
  "Machine Learning",
  "Data Science",
  "Pandas",
  "NumPy",
  "R",
  "MATLAB",
  "Cypress",
  "Playwright",
  "Selenium",
  "Jest",
  "Mocha",
  "JUnit",
  "pytest",
  "Agile",
  "Scrum",
  "JIRA",
  "Confluence",
  "Git",
  "SVN",
  "OAuth",
  "JWT",
  "SAML",
  "SSO",
  "Microservices",
  "System Design",
  "Data Structures",
  "Algorithms",
  "OOP",
  "Functional Programming",
  "HTML",
  "CSS",
  "SASS",
  "Tailwind CSS",
  "Bootstrap",
  "Material UI",
  "Webpack",
  "Vite",
  "Rollup",
];

const JOB_TITLES = [
  "Senior React Developer",
  "Full Stack Engineer",
  "Backend Python Developer",
  "DevOps Engineer",
  "Cloud Architect",
  "Data Engineer",
  "ML Engineer",
  "QA Automation Engineer",
  "iOS Developer",
  "Android Developer",
  "Technical Lead",
  "Staff Engineer",
  "Platform Engineer",
  "SRE",
  "Frontend Developer",
  "UI/UX Engineer",
  "Java Backend Developer",
  "Node.js Developer",
  "Golang Developer",
  "Rust Systems Engineer",
  "Solutions Architect",
  "Security Engineer",
  "Database Administrator",
  "Data Scientist",
  "AI Research Engineer",
  "Product Engineer",
  "Embedded Systems Developer",
  "Firmware Engineer",
  "Network Engineer",
  "Blockchain Developer",
  "Web3 Developer",
  "AR/VR Engineer",
  "Game Developer",
  "Unity Developer",
  "Unreal Engine Developer",
  "ETL Developer",
  "BI Analyst",
  "Salesforce Developer",
  "SAP Consultant",
  "ServiceNow Developer",
  "Mainframe Developer",
  "Technical Writer",
  "Developer Advocate",
  "Release Engineer",
  "Performance Engineer",
  "Accessibility Engineer",
  "Localization Engineer",
  "Integration Engineer",
  "API Developer",
  "Middleware Developer",
  "Infrastructure Engineer",
  "Reliability Engineer",
];

const JOB_DESC_TEMPLATES = [
  "We are looking for a talented {title} to join our growing team. You will work on building scalable applications using modern technologies. Strong problem-solving skills and experience with {skill1}, {skill2}, and {skill3} are essential.",
  "Join our innovative engineering team as a {title}. In this role, you'll design and implement solutions using {skill1} and {skill2}. We value clean code, thorough testing, and collaborative development.",
  "Exciting opportunity for an experienced {title}! You'll lead development efforts involving {skill1}, {skill2}, and {skill3}. Remote-friendly culture with competitive compensation.",
  "We're hiring a {title} to help scale our platform. The ideal candidate has hands-on experience with {skill1} and {skill2}, strong communication skills, and a passion for building great software.",
  "As a {title}, you'll be responsible for architecting and delivering high-quality software. Our tech stack includes {skill1}, {skill2}, and {skill3}. We offer excellent benefits and growth opportunities.",
];

const COMPANIES = [
  "Google",
  "Meta",
  "Amazon",
  "Microsoft",
  "Apple",
  "Netflix",
  "Spotify",
  "Stripe",
  "Uber",
  "Lyft",
  "Airbnb",
  "DoorDash",
  "Shopify",
  "Twilio",
  "Atlassian",
  "Slack",
  "Zoom",
  "Snowflake",
  "Databricks",
  "Figma",
  "Notion",
  "Linear",
  "Vercel",
  "Supabase",
  "Cloudflare",
  "DigitalOcean",
  "HashiCorp",
  "MongoDB Inc",
  "Elastic",
  "Confluent",
  "Palantir",
  "Coinbase",
  "Robinhood",
  "Square",
  "Plaid",
  "Brex",
  "Ripple",
  "OpenAI",
  "Anthropic",
  "Cohere",
  "Hugging Face",
  "Scale AI",
  "DataRobot",
  "C3.ai",
  "UiPath",
  "Infosys",
  "TCS",
  "Wipro",
  "Cognizant",
  "Accenture",
  "Deloitte",
  "Capgemini",
  "IBM",
  "Oracle",
  "SAP",
  "Salesforce",
  "Adobe",
  "VMware",
  "Dell Technologies",
];

const ROLES = [
  "Software Engineer",
  "Senior Developer",
  "Lead Engineer",
  "Staff Engineer",
  "Principal Engineer",
  "Architect",
  "Engineering Manager",
  "Tech Lead",
  "Full Stack Developer",
  "Frontend Developer",
  "Backend Developer",
  "DevOps Engineer",
  "QA Engineer",
  "Data Analyst",
  "Data Scientist",
  "ML Engineer",
  "SRE",
  "Product Manager",
  "Scrum Master",
  "Project Manager",
  "Business Analyst",
  "UI Designer",
  "UX Researcher",
  "Solutions Consultant",
  "Technical Writer",
];

const BIOS = [
  "Passionate software engineer with {exp} years of experience building scalable applications. Strong background in {skill1} and {skill2}.",
  "Results-driven developer specializing in {skill1} and {skill2}. Love solving complex problems and mentoring junior engineers.",
  "Full-stack developer with expertise in {skill1}, {skill2}, and cloud technologies. {exp} years in the industry.",
  "Detail-oriented engineer focused on code quality, performance, and user experience. Proficient in {skill1} and {skill2}.",
  "Experienced professional with a proven track record in {skill1} and {skill2}. Worked on products used by millions of users.",
];

const VISIBILITY_CONFIGS: Record<string, string[]>[] = [
  { full_time: ["w2", "c2h"], contract: ["c2c"] },
  { full_time: ["w2"], contract: ["c2c", "c2h"] },
  { full_time: [], contract: [] }, // all sub-types
  { contract: ["c2c", "1099"] },
  { full_time: ["w2", "direct_hire"], part_time: ["w2"] },
  { full_time: ["salary"], contract: ["w2"] },
  { full_time: ["c2h"], part_time: ["1099"] },
  { contract: [] }, // all contract sub-types
  {}, // no config = visible everywhere
  {
    full_time: ["w2", "c2h", "direct_hire", "salary"],
    contract: ["c2c", "c2h", "1099", "w2"],
    part_time: ["w2", "1099"],
  },
];

const APP_STATUSES: Array<
  "pending" | "reviewing" | "shortlisted" | "rejected" | "hired"
> = [
  "pending",
  "pending",
  "pending", // weighted toward pending
  "reviewing",
  "reviewing",
  "shortlisted",
  "rejected",
  "hired",
];

const COVER_LETTERS = [
  "I am very interested in this position and believe my experience with {skill1} and {skill2} makes me a strong candidate. I look forward to discussing how I can contribute to your team.",
  "With {exp} years of hands-on experience, I am confident I can add value to your team. My expertise in {skill1} aligns perfectly with this role's requirements.",
  "I'm excited about this opportunity! My background in {skill1} and {skill2}, combined with my passion for clean code, make me an ideal fit.",
  "This role caught my attention because of its focus on {skill1}. I have extensive experience in this area and would love to bring my skills to your organization.",
  "As a {role} with {exp} years of experience, I've built solutions using {skill1} and {skill2}. I'd be thrilled to contribute to your team's success.",
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

/* ─── Build Data ─── */

function buildJobs(): any[] {
  const jobs: any[] = [];
  for (let i = 0; i < 150; i++) {
    const vendor = pick(VENDORS);
    const title = pick(JOB_TITLES);
    const jobType = pick(JOB_TYPES);
    const subType = pick(JOB_SUB_TYPES[jobType]);
    const workMode = pick(WORK_MODES);
    const skills = pickN(SKILL_POOL, randInt(3, 8));
    const exp = randInt(0, 15);
    const baseRate = randInt(25, 120);
    const desc = pick(JOB_DESC_TEMPLATES)
      .replace("{title}", title)
      .replace("{skill1}", skills[0] || "JavaScript")
      .replace("{skill2}", skills[1] || "TypeScript")
      .replace("{skill3}", skills[2] || "React");

    // ~85% active, ~15% closed
    const isActive = Math.random() > 0.15;
    const createdAt = randDate(180);

    jobs.push({
      title,
      description: desc,
      vendorId: vendor.id,
      vendorEmail: vendor.email,
      recruiterName: vendor.name,
      recruiterPhone: vendor.phone,
      location: pick(LOCATIONS),
      jobType,
      jobSubType: subType,
      workMode,
      salaryMin: baseRate * 2000,
      salaryMax: baseRate * 2000 + randInt(10000, 40000),
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

function buildCandidates(): any[] {
  const profiles: any[] = [];

  // 10 known candidates (match shell-services seed IDs)
  for (const cand of KNOWN_CANDIDATES) {
    const skills = pickN(SKILL_POOL, randInt(4, 10));
    const exp = randInt(1, 18);
    const vis = pick(VISIBILITY_CONFIGS);
    const bio = pick(BIOS)
      .replace("{exp}", String(exp))
      .replace("{skill1}", skills[0])
      .replace("{skill2}", skills[1]);

    profiles.push({
      candidateId: cand.id,
      username:
        cand.name.toLowerCase().replace(/\s/g, "-") + "-" + cand.id.slice(0, 6),
      name: cand.name,
      email: cand.email,
      phone: `+1-555-${String(profiles.length + 100).padStart(4, "0")}`,
      currentCompany: pick(COMPANIES),
      currentRole: pick(ROLES),
      preferredJobType: pick(["full_time", "contract", "part_time"]),
      expectedHourlyRate: randInt(30, 150),
      experienceYears: exp,
      skills,
      location: pick(LOCATIONS),
      bio,
      resumeSummary: `Experienced ${pick(ROLES)} with ${exp} years in ${skills.slice(0, 3).join(", ")}. Track record of delivering high-quality software at scale.`,
      resumeExperience: `• ${pick(COMPANIES)} — ${pick(ROLES)} (${randInt(1, 4)} years)\n• ${pick(COMPANIES)} — ${pick(ROLES)} (${randInt(1, 5)} years)\n• ${pick(COMPANIES)} — ${pick(ROLES)} (${randInt(1, 3)} years)`,
      resumeEducation: `B.S. Computer Science, ${pick(["MIT", "Stanford", "UC Berkeley", "Georgia Tech", "CMU", "Caltech", "U of Michigan", "UT Austin", "U of Washington", "Cornell"])} (${2026 - exp - randInt(0, 4)})`,
      resumeAchievements: `• Led migration to ${pick(["microservices", "serverless", "Kubernetes", "cloud-native"])} architecture\n• Reduced page load time by ${randInt(30, 70)}%\n• Mentored ${randInt(2, 10)} junior engineers`,
      profileLocked: Math.random() > 0.3,
      visibilityConfig: vis,
      createdAt: randDate(270),
    });
  }

  // 70 new candidates
  const usedNames = new Set(KNOWN_CANDIDATES.map((c) => c.name));
  for (let i = 0; i < 70; i++) {
    let firstName: string, lastName: string, fullName: string;
    do {
      firstName = pick(FIRST_NAMES);
      lastName = pick(LAST_NAMES);
      fullName = `${firstName} ${lastName}`;
    } while (usedNames.has(fullName));
    usedNames.add(fullName);

    const id = randomUUID();
    const skills = pickN(SKILL_POOL, randInt(3, 12));
    const exp = randInt(0, 20);
    const vis = pick(VISIBILITY_CONFIGS);
    const bio = pick(BIOS)
      .replace("{exp}", String(exp))
      .replace("{skill1}", skills[0])
      .replace("{skill2}", skills[1] || skills[0]);

    profiles.push({
      candidateId: id,
      username: `${firstName.toLowerCase()}-${lastName.toLowerCase()}-${id.slice(0, 6)}`,
      name: fullName,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`,
      phone: `+1-555-${String(profiles.length + 100).padStart(4, "0")}`,
      currentCompany: pick(COMPANIES),
      currentRole: pick(ROLES),
      preferredJobType: pick([
        "full_time",
        "full_time",
        "contract",
        "contract",
        "part_time",
      ]),
      expectedHourlyRate: randInt(20, 180),
      experienceYears: exp,
      skills,
      location: pick(LOCATIONS),
      bio,
      resumeSummary: `${pick(ROLES)} with ${exp} years of professional experience specializing in ${skills.slice(0, 3).join(", ")}. Passionate about building impactful products.`,
      resumeExperience: `• ${pick(COMPANIES)} — ${pick(ROLES)} (${randInt(1, 5)} years)\n• ${pick(COMPANIES)} — ${pick(ROLES)} (${randInt(1, 4)} years)${exp > 5 ? `\n• ${pick(COMPANIES)} — ${pick(ROLES)} (${randInt(1, 3)} years)` : ""}`,
      resumeEducation:
        exp > 2
          ? `B.S. ${pick(["Computer Science", "Software Engineering", "Information Technology", "Data Science", "Mathematics", "Electrical Engineering", "Computer Engineering"])}, ${pick(["MIT", "Stanford", "UC Berkeley", "Georgia Tech", "CMU", "Caltech", "U of Michigan", "UT Austin", "Illinois Tech", "Purdue", "U of Toronto", "IIT Bombay", "NIT Trichy", "U of Waterloo", "ETH Zurich", "Oxford", "Cambridge"])} (${2026 - exp - randInt(0, 4)})`
          : `Currently pursuing degree in ${pick(["Computer Science", "Software Engineering"])}`,
      resumeAchievements: `• ${pick(["Developed", "Architected", "Led", "Designed", "Built"])} ${pick(["a real-time analytics platform", "a distributed payments system", "an ML-powered recommendation engine", "a CI/CD pipeline", "a microservices migration", "a cross-platform mobile app"])}\n• ${pick(["Improved", "Reduced", "Optimized", "Enhanced"])} ${pick(["system throughput", "API latency", "deployment frequency", "test coverage", "code review turnaround"])} by ${randInt(20, 80)}%`,
      profileLocked: Math.random() > 0.25,
      visibilityConfig: vis,
      createdAt: randDate(365),
    });
  }

  return profiles;
}

function buildApplications(jobs: any[], candidates: any[]): any[] {
  const apps: any[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < 200; i++) {
    const job = pick(jobs);
    const cand = pick(candidates);
    const key = `${job._id || job.title}-${cand.candidateId}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const skills = cand.skills || [];
    const coverLetter = pick(COVER_LETTERS)
      .replace("{skill1}", skills[0] || "my core skills")
      .replace("{skill2}", skills[1] || "related technologies")
      .replace("{exp}", String(cand.experienceYears || 3))
      .replace("{role}", cand.currentRole || "developer");

    apps.push({
      jobId: job._id?.toString() || "",
      jobTitle: job.title,
      candidateId: cand.candidateId,
      candidateEmail: cand.email,
      coverLetter,
      status: pick(APP_STATUSES),
      createdAt: randDate(90),
    });
  }

  return apps;
}

function buildPokeRecords(jobs: any[], candidates: any[]): any[] {
  const records: any[] = [];
  const seen = new Set<string>();

  // 60 vendor→candidate pokes
  for (let i = 0; i < 60; i++) {
    const vendor = pick(VENDORS);
    const cand = pick(candidates);
    const job =
      pick(jobs.filter((j) => j.vendorId === vendor.id)) || pick(jobs);
    const isEmail = Math.random() > 0.5;
    const key = `${vendor.id}-${cand.candidateId}-${isEmail}`;
    if (seen.has(key)) continue;
    seen.add(key);

    records.push({
      senderId: vendor.id,
      senderName: vendor.name,
      senderEmail: vendor.email,
      senderType: "vendor",
      targetId: cand.candidateId,
      targetEmail: cand.email,
      targetName: cand.name,
      subject: pick(POKE_SUBJECTS).replace("{title}", job.title),
      isEmail,
      jobId: job._id?.toString() || "",
      jobTitle: job.title,
      createdAt: randDate(60),
    });
  }

  // 60 candidate→vendor pokes
  for (let i = 0; i < 60; i++) {
    const cand = pick(candidates);
    const job = pick(jobs);
    const isEmail = Math.random() > 0.5;
    const key = `${cand.candidateId}-${job._id || job.title}-${isEmail}`;
    if (seen.has(key)) continue;
    seen.add(key);

    records.push({
      senderId: cand.candidateId,
      senderName: cand.name,
      senderEmail: cand.email,
      senderType: "candidate",
      targetId: job._id?.toString() || "",
      targetVendorId: job.vendorId,
      targetEmail: job.vendorEmail || pick(VENDORS).email,
      targetName: job.recruiterName || pick(VENDORS).name,
      subject: pick(POKE_SUBJECTS).replace("{title}", job.title),
      isEmail,
      jobId: job._id?.toString() || "",
      jobTitle: job.title,
      createdAt: randDate(60),
    });
  }

  return records;
}

/* ─── Main ─── */

async function main() {
  await mongoose.connect(`${MONGO_URI}/${MONGO_DB}`);
  console.log("✅ MongoDB connected");

  // Clear existing data
  console.log("🗑  Clearing existing data…");
  await Promise.all([
    JobModel.deleteMany({}),
    ProfileModel.deleteMany({}),
    AppModel.deleteMany({}),
    PokeRecordModel.deleteMany({}),
    PokeLogModel.deleteMany({}),
  ]);

  // 1) Jobs
  console.log("📋 Seeding 150 jobs…");
  const jobDocs = await JobModel.insertMany(buildJobs());
  console.log(`   → ${jobDocs.length} jobs created`);

  // 2) Candidate Profiles
  console.log("👤 Seeding 80 candidate profiles…");
  const candDocs = await ProfileModel.insertMany(buildCandidates());
  console.log(`   → ${candDocs.length} profiles created`);

  // 3) Applications (need job IDs)
  console.log("📝 Seeding ~200 applications…");
  const appData = buildApplications(jobDocs as any, candDocs as any);
  const appDocs = await AppModel.insertMany(appData);
  console.log(`   → ${appDocs.length} applications created`);

  // 4) Poke Records
  console.log("⚡ Seeding ~120 poke/email records…");
  const pokeData = buildPokeRecords(jobDocs as any, candDocs as any);
  const pokeDocs = await PokeRecordModel.insertMany(pokeData);
  console.log(`   → ${pokeDocs.length} poke records created`);

  // 5) Poke Logs (rate-limit counters)
  console.log("📊 Seeding poke logs…");
  const logEntries: any[] = [];
  const yearMonth = "2026-02";
  for (const cand of candDocs.slice(0, 20)) {
    logEntries.push({
      userId: cand.candidateId,
      yearMonth,
      count: randInt(1, 15),
    });
  }
  for (const v of VENDORS.slice(0, 8)) {
    logEntries.push({ userId: v.id, yearMonth, count: randInt(1, 30) });
  }
  const logDocs = await PokeLogModel.insertMany(logEntries);
  console.log(`   → ${logDocs.length} poke log entries created`);

  // Summary
  console.log("\n═══════════════════════════════════════════");
  console.log("  SEED SUMMARY");
  console.log("═══════════════════════════════════════════");
  console.log(`  Jobs:            ${jobDocs.length}`);
  console.log(`  Candidates:      ${candDocs.length}`);
  console.log(`  Applications:    ${appDocs.length}`);
  console.log(`  Poke Records:    ${pokeDocs.length}`);
  console.log(`  Poke Logs:       ${logDocs.length}`);
  console.log("═══════════════════════════════════════════");

  // Stats breakdown
  const activeJobs = jobDocs.filter((j: any) => j.isActive).length;
  const closedJobs = jobDocs.length - activeJobs;
  const ftJobs = jobDocs.filter((j: any) => j.jobType === "full_time").length;
  const ctJobs = jobDocs.filter((j: any) => j.jobType === "contract").length;
  const ptJobs = jobDocs.filter((j: any) => j.jobType === "part_time").length;
  const intJobs = jobDocs.filter((j: any) => j.jobType === "internship").length;
  console.log(`\n  Jobs: ${activeJobs} active, ${closedJobs} closed`);
  console.log(
    `  Types: ${ftJobs} full_time, ${ctJobs} contract, ${ptJobs} part_time, ${intJobs} internship`,
  );

  const profileLocked = candDocs.filter((c: any) => c.profileLocked).length;
  console.log(
    `  Profiles: ${profileLocked} locked, ${candDocs.length - profileLocked} unlocked`,
  );

  const appsByStatus: Record<string, number> = {};
  appDocs.forEach((a: any) => {
    appsByStatus[a.status] = (appsByStatus[a.status] || 0) + 1;
  });
  console.log(`  Applications: ${JSON.stringify(appsByStatus)}`);

  const pokeCount = pokeDocs.filter((p: any) => !p.isEmail).length;
  const emailCount = pokeDocs.filter((p: any) => p.isEmail).length;
  console.log(`  Pokes: ${pokeCount} quick pokes, ${emailCount} emails`);

  console.log("\n✅ Done! Data is ready for testing.");
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
