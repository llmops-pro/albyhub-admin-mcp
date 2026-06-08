import { z } from "zod";

const boolish = z
  .string()
  .optional()
  .transform((v) => v === "true" || v === "1");

const positiveInt = z.coerce.number().int().positive();

const ConfigSchema = z.object({
  ALBYHUB_URL: z
    .string()
    .min(1, "ALBYHUB_URL is required")
    .refine(
      (s) => {
        try {
          new URL(s);
          return true;
        } catch {
          return false;
        }
      },
      "ALBYHUB_URL must be a valid URL (e.g. http://localhost:8080)",
    ),
  ALBYHUB_TOKEN: z
    .string()
    .min(1, "ALBYHUB_TOKEN is required — get one from your Alby Hub UI Settings → Developer / Apps"),
  ALBYHUB_READ_ONLY: boolish,
  ALBYHUB_REQUIRE_CONFIRM: boolish,
  ALBYHUB_MAX_REQUESTS_PER_MINUTE: positiveInt.default(30),
  ALBYHUB_LOG_PATH: z.string().default("./albyhub-admin-mcp.log"),
  ALBYHUB_AUDIT_PATH: z.string().default("./albyhub-admin-mcp-audit.log"),
});

export type Config = z.infer<typeof ConfigSchema>;

export function loadConfig(): Config {
  const parsed = ConfigSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    process.stderr.write(
      `albyhub-admin-mcp: invalid configuration:\n${issues}\n\nSet the required env vars and try again.\n`,
    );
    process.exit(1);
  }
  return parsed.data;
}
