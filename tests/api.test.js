import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import path from "node:path";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { app } from "../src/app.js";
import { env } from "../src/config/env.js";
import { User } from "../src/models/User.js";

let mongo;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create({ binary: { downloadDir: path.resolve(".cache", "mongodb-binaries") } });
  await mongoose.connect(mongo.getUri());
});

beforeEach(async () => {
  await mongoose.connection.db.dropDatabase();
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});

async function register(agent, overrides = {}) {
  const payload = { name: "Sanjana Tester", email: "sanjana@example.com", password: "Secure123!", ...overrides };
  const response = await agent.post("/api/auth/register").send(payload);
  return { response, csrf: response.body.data?.csrfToken };
}

describe("authentication", () => {
  it("registers a user, hashes the password, and restores the session", async () => {
    const agent = request.agent(app);
    const { response } = await register(agent);

    expect(response.status).toBe(201);
    expect(response.body.data.user).toMatchObject({ name: "Sanjana Tester", email: "sanjana@example.com" });
    expect(response.body.data.user).not.toHaveProperty("password");
    expect(response.headers["set-cookie"].join(";")).toContain("todo_session=");

    const stored = await User.findOne({ email: "sanjana@example.com" }).select("+password");
    expect(stored.password).not.toBe("Secure123!");
    expect(stored.password.startsWith("$2")).toBe(true);

    const me = await agent.get("/api/auth/me");
    expect(me.status).toBe(200);
    expect(me.body.data.user.email).toBe("sanjana@example.com");
  });

  it("rejects invalid registration and duplicate email", async () => {
    const agent = request.agent(app);
    const invalid = await agent.post("/api/auth/register").send({ name: "S", email: "wrong", password: "small" });
    expect(invalid.status).toBe(400);
    expect(invalid.body.errors.length).toBeGreaterThan(0);

    const weakPassword = await agent
      .post("/api/auth/register")
      .send({ name: "Valid User", email: "valid@example.com", password: "lowercase1!" });
    expect(weakPassword.status).toBe(400);
    expect(weakPassword.body.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ message: "Password must contain an uppercase letter" })]),
    );

    await register(agent);
    const duplicate = await request(app)
      .post("/api/auth/register")
      .send({ name: "Other User", email: "SANJANA@example.com", password: "Secure123!" });
    expect(duplicate.status).toBe(409);
  });

  it("logs in with correct credentials and rejects an incorrect password", async () => {
    await register(request.agent(app));
    const good = await request(app)
      .post("/api/auth/login")
      .send({ email: "sanjana@example.com", password: "Secure123!" });
    expect(good.status).toBe(200);
    expect(good.body.data.csrfToken).toHaveLength(64);

    const bad = await request(app).post("/api/auth/login").send({ email: "sanjana@example.com", password: "Wrong123" });
    expect(bad.status).toBe(401);
  });

  it("rejects missing, invalid, and expired sessions", async () => {
    expect((await request(app).get("/api/tasks")).status).toBe(401);
    expect((await request(app).get("/api/tasks").set("Cookie", "todo_session=not-a-token")).status).toBe(401);

    const user = await User.create({ name: "Expired User", email: "expired@example.com", password: "unused-hash" });
    const expired = jwt.sign({}, env.jwtSecret, { subject: user._id.toString(), expiresIn: -1 });
    expect((await request(app).get("/api/tasks").set("Cookie", `todo_session=${expired}`)).status).toBe(401);
  });
});

describe("user-scoped task API", () => {
  it("lists open tasks before completed tasks and keeps each group newest first", async () => {
    const agent = request.agent(app);
    const { csrf } = await register(agent);
    const task = (title, status) => ({
      title,
      status,
      scheduledAt: "2026-11-04T09:30:00.000Z",
      priority: "Medium",
    });

    await agent.post("/api/tasks").set("x-csrf-token", csrf).send(task("Older open task", "Pending"));
    await agent.post("/api/tasks").set("x-csrf-token", csrf).send(task("Completed task", "Completed"));
    await agent.post("/api/tasks").set("x-csrf-token", csrf).send(task("Newest open task", "In Progress"));

    const listed = await agent.get("/api/tasks?sort=activeNewest");

    expect(listed.status).toBe(200);
    expect(listed.body.data.map(({ title }) => title)).toEqual([
      "Newest open task",
      "Older open task",
      "Completed task",
    ]);
  });

  it("creates, reads, edits, searches, summarizes, and deletes a task", async () => {
    const agent = request.agent(app);
    const { csrf } = await register(agent);
    const payload = {
      title: "Finish responsive wireframe",
      description: "Review the mobile dashboard",
      scheduledAt: "2026-11-03T09:30:00.000Z",
      priority: "High",
    };

    const created = await agent.post("/api/tasks").set("x-csrf-token", csrf).send(payload);
    expect(created.status).toBe(201);
    expect(created.body.data).toMatchObject({ title: payload.title, status: "Pending", priority: "High" });
    const taskId = created.body.data._id;

    const listed = await agent.get("/api/tasks");
    expect(listed.status).toBe(200);
    expect(listed.body.data).toHaveLength(1);
    expect(listed.body.meta.total).toBe(1);

    const one = await agent.get(`/api/tasks/${taskId}`);
    expect(one.body.data.description).toContain("mobile dashboard");

    const updated = await agent
      .put(`/api/tasks/${taskId}`)
      .set("x-csrf-token", csrf)
      .send({ status: "Completed", title: "Finish polished wireframe" });
    expect(updated.status).toBe(200);
    expect(updated.body.data.status).toBe("Completed");

    const searched = await agent.get("/api/tasks/search?q=POLISHED");
    expect(searched.status).toBe(200);
    expect(searched.body.data[0]._id).toBe(taskId);

    const summary = await agent.get("/api/tasks/weekly-summary?timezone=Asia%2FCalcutta");
    expect(summary.status).toBe(200);
    expect(summary.body.data[0]).toMatchObject({
      weekStart: "2026-11-02",
      weekEnd: "2026-11-08",
      totalTasks: 1,
      completedTasks: 1,
      openTasks: 0,
    });

    const analytics = await agent.get("/api/tasks/analytics?range=week&timezone=Asia%2FCalcutta");
    expect(analytics.status).toBe(200);
    expect(analytics.body.data).toMatchObject({
      total: 1,
      completionRate: 100,
      status: { pending: 0, inProgress: 0, completed: 1 },
    });

    const removed = await agent.delete(`/api/tasks/${taskId}`).set("x-csrf-token", csrf);
    expect(removed.status).toBe(200);
    expect((await agent.get("/api/tasks")).body.data).toHaveLength(0);
  });

  it("enforces CSRF and validates task input and IDs", async () => {
    const agent = request.agent(app);
    const { csrf } = await register(agent);
    expect((await agent.post("/api/tasks").send({ title: "No CSRF" })).status).toBe(403);

    const invalid = await agent
      .post("/api/tasks")
      .set("x-csrf-token", csrf)
      .send({ title: "", scheduledAt: "not-a-date", priority: "Urgent" });
    expect(invalid.status).toBe(400);
    expect(invalid.body.message).toBe("Validation failed");
    expect((await agent.get("/api/tasks/not-an-id")).status).toBe(400);
    expect((await agent.get(`/api/tasks/${new mongoose.Types.ObjectId()}`)).status).toBe(404);
  });

  it("prevents one user from reading, editing, deleting, searching, or summarizing another user's tasks", async () => {
    const owner = request.agent(app);
    const ownerAuth = await register(owner);
    const created = await owner
      .post("/api/tasks")
      .set("x-csrf-token", ownerAuth.csrf)
      .send({ title: "Owner private task", description: "private keyword", scheduledAt: "2026-11-03T09:30:00.000Z" });
    const taskId = created.body.data._id;

    const outsider = request.agent(app);
    const outsiderAuth = await register(outsider, { name: "Second User", email: "second@example.com" });
    expect((await outsider.get(`/api/tasks/${taskId}`)).status).toBe(404);
    expect(
      (await outsider.put(`/api/tasks/${taskId}`).set("x-csrf-token", outsiderAuth.csrf).send({ title: "Stolen" }))
        .status,
    ).toBe(404);
    expect((await outsider.delete(`/api/tasks/${taskId}`).set("x-csrf-token", outsiderAuth.csrf)).status).toBe(404);
    expect((await outsider.get("/api/tasks/search?q=private")).body.data).toHaveLength(0);
    expect((await outsider.get("/api/tasks/weekly-summary?timezone=UTC")).body.data).toHaveLength(0);
  });

  it("clears the session on logout", async () => {
    const agent = request.agent(app);
    const { csrf } = await register(agent);
    const logout = await agent.post("/api/auth/logout").set("x-csrf-token", csrf);
    expect(logout.status).toBe(200);
    expect((await agent.get("/api/tasks")).status).toBe(401);
  });
});
