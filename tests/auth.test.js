import request from "supertest";
import { app } from "../src/app.js";
import { connectTestDB, closeTestDB, clearTestDB } from "./setup/db.js";

const testUser = {
    username: "testuser",
    email: "test@test.com",
    fullName: "Test User",
    password: "Test@123"
};

beforeAll(async () => await connectTestDB());
afterAll(async () => await closeTestDB());
afterEach(async () => await clearTestDB());

describe("🔐 Auth API", () => {

    // ===== REGISTER =====
    describe("POST /api/auth/register", () => {

        it("should register a new user successfully", async () => {
            const res = await request(app)
                .post("/api/auth/register")
                .send(testUser);
            console.log("RESPONSE BODY:", JSON.stringify(res.body, null, 2));
            expect(res.statusCode).toBe(201);
            expect(res.body.success).toBe(true);
            expect(res.body.data.user.email).toBe(testUser.email);
            expect(res.body.data.user).not.toHaveProperty("password");
        });

        it("should fail with missing fields", async () => {
            const res = await request(app)
                .post("/api/auth/register")
                .send({ email: "test@test.com" });

            expect(res.statusCode).toBe(400);
            expect(res.body.success).toBe(false);
        });

        it("should fail with duplicate email", async () => {
            await request(app)
                .post("/api/auth/register")
                .send(testUser);

            const res = await request(app)
                .post("/api/auth/register")
                .send(testUser);

            expect(res.statusCode).toBe(409);
            expect(res.body.success).toBe(false);
        });

        it("should fail with invalid email format", async () => {
            const res = await request(app)
                .post("/api/auth/register")
                .send({ ...testUser, email: "notanemail" });

            expect(res.statusCode).toBe(400);
            expect(res.body.success).toBe(false);
        });
    });

    // ===== LOGIN =====
    describe("POST /api/auth/login", () => {

        beforeEach(async () => {
            await request(app)
                .post("/api/auth/register")
                .send(testUser);
        });

        it("should login successfully with email", async () => {
            const res = await request(app)
                .post("/api/auth/login")
                .send({
                    email: testUser.email,
                    password: testUser.password
                });

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
            expect(res.body.data).toHaveProperty("accessToken");
        });

        it("should login successfully with username", async () => {
            const res = await request(app)
                .post("/api/auth/login")
                .send({
                    username: testUser.username,
                    password: testUser.password
                });

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
        });

        it("should fail with wrong password", async () => {
            const res = await request(app)
                .post("/api/auth/login")
                .send({
                    email: testUser.email,
                    password: "wrongpassword"
                });

            expect(res.statusCode).toBe(401);
            expect(res.body.success).toBe(false);
        });

        it("should fail with non-existent user", async () => {
            const res = await request(app)
                .post("/api/auth/login")
                .send({
                    email: "nobody@test.com",
                    password: "Test@123"
                });

            expect(res.statusCode).toBe(404);
            expect(res.body.success).toBe(false);
        });
    });

    // ===== LOGOUT =====
    describe("POST /api/auth/logout", () => {

        it("should logout successfully", async () => {
            const registerRes = await request(app)
                .post("/api/auth/register")
                .send(testUser);

            const { accessToken } = registerRes.body.data;

            const res = await request(app)
                .post("/api/auth/logout")
                .set("Authorization", `Bearer ${accessToken}`);

            expect(res.statusCode).toBe(200);
            expect(res.body.success).toBe(true);
        });

        it("should fail without token", async () => {
            const res = await request(app)
                .post("/api/auth/logout");

            expect(res.statusCode).toBe(401);
        });
    });
});