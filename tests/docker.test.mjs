import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();

test("Docker Containerization & Configuration", async (t) => {
  await t.test("next.config.ts has output: 'standalone' enabled", () => {
    const nextConfigPath = path.join(rootDir, "next.config.ts");
    assert.ok(fs.existsSync(nextConfigPath), "next.config.ts must exist");
    const content = fs.readFileSync(nextConfigPath, "utf8");
    assert.match(
      content,
      /output:\s*["']standalone["']/,
      "next.config.ts must specify output: 'standalone'"
    );
  });

  await t.test(".dockerignore exists and excludes sensitive and unnecessary assets", () => {
    const dockerignorePath = path.join(rootDir, ".dockerignore");
    assert.ok(fs.existsSync(dockerignorePath), ".dockerignore must exist");
    const content = fs.readFileSync(dockerignorePath, "utf8");
    
    // Check exclusions
    assert.match(content, /node_modules/, ".dockerignore must exclude node_modules");
    assert.match(content, /\.next/, ".dockerignore must exclude .next");
    assert.match(content, /\.env/, ".dockerignore must exclude .env files");
    assert.match(content, /\.git/, ".dockerignore must exclude .git");
    assert.match(content, /tests/, ".dockerignore must exclude test directory");
  });

  await t.test("Dockerfile implements multi-stage build pattern", () => {
    const dockerfilePath = path.join(rootDir, "Dockerfile");
    assert.ok(fs.existsSync(dockerfilePath), "Dockerfile must exist");
    const content = fs.readFileSync(dockerfilePath, "utf8");

    // Check multi-stage definitions
    assert.match(content, /AS\s+base/i, "Dockerfile must define a base stage");
    assert.match(content, /AS\s+deps/i, "Dockerfile must define a deps stage");
    assert.match(content, /AS\s+builder/i, "Dockerfile must define a builder stage");
    assert.match(content, /AS\s+runner/i, "Dockerfile must define a runner stage");
    
    // Base image
    assert.match(content, /node:20-alpine/i, "Dockerfile should use node:20-alpine");
  });

  await t.test("Dockerfile implements security hardening and non-root execution", () => {
    const dockerfilePath = path.join(rootDir, "Dockerfile");
    const content = fs.readFileSync(dockerfilePath, "utf8");

    // Security & non-root user
    assert.match(content, /adduser.*nextjs|addgroup.*nodejs/i, "Dockerfile must create non-root user nextjs");
    assert.match(content, /USER\s+nextjs/i, "Dockerfile must switch to USER nextjs");
    
    // Production port and host
    assert.match(content, /EXPOSE\s+3000/i, "Dockerfile must expose port 3000");
    assert.match(content, /HOSTNAME="0\.0\.0\.0"/i, "Dockerfile should set HOSTNAME to 0.0.0.0");

    // Prisma client generation
    assert.match(content, /prisma\s+generate/i, "Dockerfile must run prisma generate during build");

    // Standalone server execution
    assert.match(content, /CMD\s*\[\s*["']node["']\s*,\s*["']server\.js["']\s*\]/i, "Dockerfile must start node server.js");
  });

  await t.test("docker-compose.yml defines production vault service", () => {
    const composePath = path.join(rootDir, "docker-compose.yml");
    assert.ok(fs.existsSync(composePath), "docker-compose.yml must exist");
    const content = fs.readFileSync(composePath, "utf8");

    assert.match(content, /services:/, "docker-compose.yml must contain services");
    assert.match(content, /3000:3000/, "docker-compose.yml must map port 3000");
    assert.match(content, /NODE_ENV=production|NODE_ENV:\s*production/, "docker-compose.yml must set NODE_ENV=production");
  });

  await t.test("standalone build produces server.js", () => {
    const standaloneServerPath = path.join(rootDir, ".next", "standalone", "server.js");
    assert.ok(
      fs.existsSync(standaloneServerPath),
      ".next/standalone/server.js must exist after build"
    );
  });
});
