import swaggerJsdoc from "swagger-jsdoc";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "MatchDB Jobs Services API",
      version: "1.0.0",
      description:
        "Jobs, Candidate Profiles, Applications & Matching API for the MatchDB platform. Handles job postings, candidate profiles, skill-based matching, resume generation, and vendor–candidate interactions.",
      contact: { name: "MatchDB Team" },
    },
    servers: [
      { url: "/api/jobs", description: "Default (relative)" },
      {
        url: "http://localhost:8001/api/jobs",
        description: "Local development",
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
      schemas: {
        // ── Job ────────────────────────────────────────────────
        Job: {
          type: "object",
          properties: {
            _id: { type: "string" },
            title: { type: "string" },
            description: { type: "string" },
            company: { type: "string" },
            location: { type: "string" },
            job_type: {
              type: "string",
              enum: ["full_time", "part_time", "contract"],
            },
            job_subtype: {
              type: "string",
              enum: ["c2c", "c2h", "w2", "1099", "direct_hire", "salary"],
            },
            work_mode: { type: "string", enum: ["remote", "onsite", "hybrid"] },
            salary_min: { type: "number", nullable: true },
            salary_max: { type: "number", nullable: true },
            pay_per_hour: { type: "number", nullable: true },
            skills_required: { type: "array", items: { type: "string" } },
            experience_required: { type: "number" },
            recruiter_name: { type: "string" },
            recruiter_email: { type: "string" },
            recruiter_phone: { type: "string" },
            status: { type: "string", enum: ["active", "closed"] },
            vendor_id: { type: "string" },
            vendor_email: { type: "string" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        CreateJobRequest: {
          type: "object",
          required: [
            "title",
            "description",
            "company",
            "location",
            "job_type",
            "skills_required",
            "experience_required",
          ],
          properties: {
            title: { type: "string" },
            description: { type: "string" },
            company: { type: "string" },
            location: { type: "string" },
            job_type: {
              type: "string",
              enum: ["full_time", "part_time", "contract"],
            },
            job_subtype: { type: "string" },
            work_mode: { type: "string", enum: ["remote", "onsite", "hybrid"] },
            salary_min: { type: "number" },
            salary_max: { type: "number" },
            pay_per_hour: { type: "number" },
            skills_required: { type: "array", items: { type: "string" } },
            experience_required: { type: "number" },
            recruiter_name: { type: "string" },
            recruiter_email: { type: "string" },
            recruiter_phone: { type: "string" },
          },
        },
        // ── Candidate Profile ─────────────────────────────────
        CandidateProfile: {
          type: "object",
          properties: {
            _id: { type: "string" },
            user_id: { type: "string" },
            email: { type: "string" },
            name: { type: "string" },
            phone: { type: "string" },
            location: { type: "string" },
            current_company: { type: "string" },
            current_role: { type: "string" },
            preferred_job_type: { type: "string" },
            expected_hourly_rate: { type: "number", nullable: true },
            experience_years: { type: "number" },
            skills: { type: "array", items: { type: "string" } },
            bio: { type: "string" },
            resume_summary: { type: "string" },
            resume_experience: { type: "string" },
            resume_education: { type: "string" },
            resume_achievements: { type: "string" },
            username: { type: "string" },
          },
        },
        UpsertProfileRequest: {
          type: "object",
          required: [
            "name",
            "email",
            "preferred_job_type",
            "experience_years",
            "skills",
          ],
          properties: {
            name: { type: "string" },
            email: { type: "string" },
            phone: { type: "string" },
            location: { type: "string" },
            current_company: { type: "string" },
            current_role: { type: "string" },
            preferred_job_type: { type: "string" },
            expected_hourly_rate: { type: "number" },
            experience_years: { type: "number" },
            skills: { type: "array", items: { type: "string" } },
            bio: { type: "string" },
            resume_summary: { type: "string" },
            resume_experience: { type: "string" },
            resume_education: { type: "string" },
            resume_achievements: { type: "string" },
          },
        },
        // ── Application ───────────────────────────────────────
        Application: {
          type: "object",
          properties: {
            _id: { type: "string" },
            job_id: { type: "string" },
            candidate_id: { type: "string" },
            candidate_email: { type: "string" },
            status: { type: "string" },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        // ── Match ─────────────────────────────────────────────
        MatchResult: {
          type: "object",
          properties: {
            job: { $ref: "#/components/schemas/Job" },
            profile: { $ref: "#/components/schemas/CandidateProfile" },
            matchPercentage: { type: "number" },
          },
        },
        // ── Poke ──────────────────────────────────────────────
        PokeRequest: {
          type: "object",
          required: ["targetEmail"],
          properties: {
            targetEmail: { type: "string", format: "email" },
            message: { type: "string" },
          },
        },
        Error: {
          type: "object",
          properties: {
            error: { type: "string" },
          },
        },
      },
    },
    // ── Paths ──────────────────────────────────────────────────
    paths: {
      // ===== PUBLIC ================================================
      "/": {
        get: {
          tags: ["Public"],
          summary: "List all active jobs",
          parameters: [
            {
              name: "type",
              in: "query",
              schema: { type: "string" },
              description: "Filter by job_type",
            },
            {
              name: "subtype",
              in: "query",
              schema: { type: "string" },
              description: "Filter by job_subtype",
            },
          ],
          responses: {
            200: {
              description: "List of jobs",
              content: {
                "application/json": {
                  schema: {
                    type: "array",
                    items: { $ref: "#/components/schemas/Job" },
                  },
                },
              },
            },
          },
        },
      },
      "/profiles-public": {
        get: {
          tags: ["Public"],
          summary: "List publicly visible candidate profiles",
          responses: {
            200: {
              description: "Public profiles",
              content: {
                "application/json": {
                  schema: {
                    type: "array",
                    items: { $ref: "#/components/schemas/CandidateProfile" },
                  },
                },
              },
            },
          },
        },
      },
      // ===== CANDIDATE ROUTES ======================================
      "/my-applications": {
        get: {
          tags: ["Candidate"],
          summary: "List jobs the candidate has applied to",
          security: [{ BearerAuth: [] }],
          responses: {
            200: {
              description: "Application list",
              content: {
                "application/json": {
                  schema: {
                    type: "array",
                    items: { $ref: "#/components/schemas/Application" },
                  },
                },
              },
            },
            401: { description: "Unauthorized" },
          },
        },
      },
      "/jobmatches": {
        get: {
          tags: ["Candidate"],
          summary: "Get skill-matched jobs ranked for the candidate",
          security: [{ BearerAuth: [] }],
          responses: {
            200: {
              description: "Matched jobs with scores",
              content: {
                "application/json": {
                  schema: {
                    type: "array",
                    items: { $ref: "#/components/schemas/MatchResult" },
                  },
                },
              },
            },
            401: { description: "Unauthorized" },
          },
        },
      },
      "/profile": {
        get: {
          tags: ["Profile"],
          summary: "Get current user profile",
          security: [{ BearerAuth: [] }],
          responses: {
            200: {
              description: "Profile data",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/CandidateProfile" },
                },
              },
            },
            401: { description: "Unauthorized" },
            404: { description: "Profile not found" },
          },
        },
        post: {
          tags: ["Profile"],
          summary: "Create candidate profile",
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/UpsertProfileRequest" },
              },
            },
          },
          responses: {
            201: {
              description: "Profile created",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/CandidateProfile" },
                },
              },
            },
            401: { description: "Unauthorized" },
            409: { description: "Profile already exists" },
          },
        },
        put: {
          tags: ["Profile"],
          summary: "Update candidate profile",
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/UpsertProfileRequest" },
              },
            },
          },
          responses: {
            200: {
              description: "Profile updated",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/CandidateProfile" },
                },
              },
            },
            401: { description: "Unauthorized" },
            404: { description: "Profile not found" },
          },
        },
        delete: {
          tags: ["Profile"],
          summary: "Delete candidate profile",
          security: [{ BearerAuth: [] }],
          responses: {
            200: { description: "Profile deleted" },
            401: { description: "Unauthorized" },
          },
        },
      },
      // ===== VENDOR ROUTES =========================================
      "/vendor": {
        get: {
          tags: ["Vendor"],
          summary: "List jobs posted by the current vendor",
          security: [{ BearerAuth: [] }],
          responses: {
            200: {
              description: "Vendor job list",
              content: {
                "application/json": {
                  schema: {
                    type: "array",
                    items: { $ref: "#/components/schemas/Job" },
                  },
                },
              },
            },
            401: { description: "Unauthorized" },
          },
        },
      },
      "/profilematches": {
        get: {
          tags: ["Vendor"],
          summary: "Get skill-matched candidates ranked for vendor jobs",
          security: [{ BearerAuth: [] }],
          parameters: [
            {
              name: "jobId",
              in: "query",
              schema: { type: "string" },
              description: "Filter matches for a specific job",
            },
          ],
          responses: {
            200: {
              description: "Matched candidates with scores",
              content: {
                "application/json": {
                  schema: {
                    type: "array",
                    items: { $ref: "#/components/schemas/MatchResult" },
                  },
                },
              },
            },
            401: { description: "Unauthorized" },
          },
        },
      },
      "/create": {
        post: {
          tags: ["Vendor"],
          summary: "Create a new job posting",
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CreateJobRequest" },
              },
            },
          },
          responses: {
            201: {
              description: "Job created",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Job" },
                },
              },
            },
            401: { description: "Unauthorized" },
            403: { description: "Job posting limit reached" },
          },
        },
      },
      // ===== SHARED ================================================
      "/poke": {
        post: {
          tags: ["Shared"],
          summary: "Send a poke (interest notification) to another user",
          security: [{ BearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/PokeRequest" },
              },
            },
          },
          responses: {
            200: { description: "Poke sent" },
            401: { description: "Unauthorized" },
            429: { description: "Poke limit exceeded" },
          },
        },
      },
      // ===== RESUME (PUBLIC) =======================================
      "/resume/{username}": {
        get: {
          tags: ["Resume"],
          summary: "Get public resume profile by username",
          parameters: [
            {
              name: "username",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            200: {
              description: "Profile data",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/CandidateProfile" },
                },
              },
            },
            404: { description: "Profile not found" },
          },
        },
      },
      "/resume/{username}/download": {
        get: {
          tags: ["Resume"],
          summary: "Download resume as text file",
          security: [{ BearerAuth: [] }],
          parameters: [
            {
              name: "username",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            200: {
              description: "Resume text file",
              content: { "text/plain": { schema: { type: "string" } } },
            },
            401: { description: "Unauthorized" },
            404: { description: "Profile not found" },
          },
        },
      },
      // ===== PARAMETERIZED =========================================
      "/{id}": {
        get: {
          tags: ["Jobs"],
          summary: "Get a single job by ID",
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            200: {
              description: "Job details",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Job" },
                },
              },
            },
            404: { description: "Job not found" },
          },
        },
      },
      "/{id}/apply": {
        post: {
          tags: ["Candidate"],
          summary: "Apply to a job",
          security: [{ BearerAuth: [] }],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            201: {
              description: "Application submitted",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Application" },
                },
              },
            },
            401: { description: "Unauthorized" },
            409: { description: "Already applied" },
          },
        },
      },
      "/{id}/close": {
        patch: {
          tags: ["Vendor"],
          summary: "Close (deactivate) a job posting",
          security: [{ BearerAuth: [] }],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            200: {
              description: "Job closed",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Job" },
                },
              },
            },
            401: { description: "Unauthorized" },
            404: { description: "Job not found" },
          },
        },
      },
      "/{id}/reopen": {
        patch: {
          tags: ["Vendor"],
          summary: "Reopen a closed job posting",
          security: [{ BearerAuth: [] }],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            200: {
              description: "Job reopened",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Job" },
                },
              },
            },
            401: { description: "Unauthorized" },
            404: { description: "Job not found" },
          },
        },
      },
    },
  },
  apis: [], // All paths defined inline above — no file scanning needed
};

export const swaggerSpec = swaggerJsdoc(options);
