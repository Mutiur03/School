import { z } from "zod";

export const setupSuperAdminSchema = z.object({
  email: z.string().email(),
  token: z.string(),
});
