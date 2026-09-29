import request from "supertest";
import { describe, expect, it } from "vitest";

describe("CORS policy", () => {
  it("allows localhost origins during development", async () => {
    process.env.NODE_ENV = "development";
    process.env.CORS_ORIGINS = "";
    const app = (await import("../app.js?cors-development")).default;
    const response = await request(app)
      .get("/api/health")
      .set("Origin", "http://localhost:5175");

    expect(response.headers["access-control-allow-origin"]).toBe("http://localhost:5175");

    const loopbackResponse = await request(app)
      .get("/api/health")
      .set("Origin", "http://127.0.0.1:5175");

    expect(loopbackResponse.headers["access-control-allow-origin"]).toBe("http://127.0.0.1:5175");
  }, 15000);

  it("allows configured production origins and rejects arbitrary origins", async () => {
    process.env.NODE_ENV = "production";
    process.env.CORS_ORIGINS = "https://carpool.example";
    const app = (await import("../app.js?cors-production")).default;
    const allowedResponse = await request(app)
      .get("/api/health")
      .set("Origin", "https://carpool.example");
    const rejectedResponse = await request(app)
      .get("/api/health")
      .set("Origin", "https://malicious.example");

    expect(allowedResponse.headers["access-control-allow-origin"]).toBe("https://carpool.example");
    expect(rejectedResponse.headers["access-control-allow-origin"]).toBeUndefined();
  }, 15000);
});
