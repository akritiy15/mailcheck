const verdictSchema = { type: "string", enum: ["deliverable", "risky", "undeliverable"] };

const resultSchema = {
  type: "object",
  properties: {
    email: { type: "string" },
    verdict: verdictSchema,
    score: { type: "integer", minimum: 0, maximum: 100 },
    reason: { type: "string" },
    checks: {
      type: "object",
      properties: {
        syntax: { type: "boolean" },
        mx: { type: "boolean", nullable: true, description: "null when DNS lookup failed temporarily" },
        disposable: { type: "boolean" },
        roleBased: { type: "boolean" },
        freeProvider: { type: "boolean" },
      },
    },
    mxHosts: { type: "array", items: { type: "string" } },
    suggestion: { type: "string", nullable: true },
  },
};

export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "MailCheck API",
    version: "1.0.0",
    description:
      "Verify email addresses without sending mail: syntax, MX records, disposable domains, role-based inboxes and typo hints.",
  },
  paths: {
    "/api/verify": {
      post: {
        summary: "Verify one email",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { type: "object", required: ["email"], properties: { email: { type: "string" } } },
            },
          },
        },
        responses: {
          "200": { description: "Verification result", content: { "application/json": { schema: resultSchema } } },
          "400": { description: "Validation error" },
          "429": { description: "Rate limit exceeded (30 req/min per IP)" },
        },
      },
    },
    "/api/verify/bulk": {
      post: {
        summary: "Verify up to 100 emails",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["emails"],
                properties: { emails: { type: "array", maxItems: 100, items: { type: "string" } } },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Results plus a summary",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    summary: {
                      type: "object",
                      properties: {
                        total: { type: "integer" },
                        deliverable: { type: "integer" },
                        risky: { type: "integer" },
                        undeliverable: { type: "integer" },
                      },
                    },
                    results: { type: "array", items: resultSchema },
                  },
                },
              },
            },
          },
          "429": { description: "Rate limit exceeded (5 req/min per IP)" },
        },
      },
    },
    "/api/history": {
      get: {
        summary: "Recent verifications (requires DATABASE_URL)",
        parameters: [{ name: "limit", in: "query", schema: { type: "integer", default: 20, maximum: 100 } }],
        responses: { "200": { description: "{ enabled, items }" } },
      },
    },
  },
};
