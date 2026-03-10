import crypto from "crypto";
import { PrismaClient } from "@prisma/client";
import EmailService from "../utils/email.service.js";
const prisma = new PrismaClient();

async function generateToken() {
  const role = "super_admin";
  const count = await prisma.superAdmin.count();
  if (count > 0) {
    console.log("Super admin already exists");
    return;
  }
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 15);//15 minutes
  await prisma.setupToken.create({
    data: {
      tokenHash,
      role,
      expiresAt,
    },
  });

  EmailService.sendSetupTokenEmail(token, role);
  await prisma.$disconnect();
}

generateToken();
