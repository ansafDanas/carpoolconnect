#!/usr/bin/env node
/**
 * Creates or promotes a platform administrator.
 *
 *   node scripts/seedAdmin.js                    -> create a new admin
 *   node scripts/seedAdmin.js you@example.com    -> promote that account
 *
 * Self-registration can never grant admin, so this is the supported way
 * to bootstrap the first one. The generated password is printed once and
 * is not stored anywhere.
 */
import crypto from "node:crypto";
import mongoose from "mongoose";
import "dotenv/config";
import User from "../models/User.js";

const PASSWORD_LENGTH = 20;

const generatePassword = () => {
  // Avoid characters that are easy to misread when copied by hand.
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  return Array.from(crypto.randomBytes(PASSWORD_LENGTH))
    .map((byte) => alphabet[byte % alphabet.length])
    .join("");
};

const main = async () => {
  const targetEmail = (process.argv[2] || "").trim().toLowerCase();

  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI is not set. Add it to server/.env first.");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);

  try {
    if (targetEmail) {
      const existing = await User.findOne({ email: targetEmail });

      if (!existing) {
        console.error(`No account found for ${targetEmail}.`);
        process.exit(1);
      }

      if (!existing.roles.includes("admin")) {
        existing.roles.push("admin");
        await existing.save();
      }

      console.log(`Promoted ${existing.email} to admin.`);
      console.log(`They can sign in with their existing password.`);
    } else {
      const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
      const password = generatePassword();

      if (!email) {
        console.error(
          "Set ADMIN_EMAIL in server/.env, or pass an email: node scripts/seedAdmin.js you@example.com"
        );
        process.exit(1);
      }

      const existing = await User.findOne({ email });

      if (existing) {
        if (!existing.roles.includes("admin")) {
          existing.roles.push("admin");
          await existing.save();
        }
        console.log(`Promoted existing account ${email} to admin.`);
        console.log("They can sign in with their existing password.");
      } else {
        await User.create({
          name: process.env.ADMIN_NAME?.trim() || "Administrator",
          email,
          password,
          roles: ["admin", "passenger"],
        });

        console.log("Created a new administrator.");
        console.log("--------------------------------------");
        console.log(`  Email:    ${email}`);
        console.log(`  Password: ${password}`);
        console.log("--------------------------------------");
        console.log("This password is shown once. Store it somewhere safe.");
      }
    }
  } finally {
    await mongoose.disconnect();
  }
};

main().catch((error) => {
  console.error("Seeding failed:", error.message);
  process.exit(1);
});