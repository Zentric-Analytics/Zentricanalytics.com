import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ authorize: vi.fn(), findMany: vi.fn(), transaction: vi.fn(), transition: vi.fn(), revalidate: vi.fn() }));
vi.mock("../src/lib/hr/internal-auth", () => ({ authorizeInternalRequest: mocks.authorize }));
vi.mock("../src/lib/prisma", () => ({ prisma: { hrVacancy: { findMany: mocks.findMany }, $transaction: mocks.transaction } }));
vi.mock("../src/lib/hr/recruitment/vacancies", () => ({ transitionVacancy: mocks.transition }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
import { POST } from "../src/app/api/internal/hr/vacancy-publication/route";

describe("scheduled publication worker", () => {
  beforeEach(() => {
    vi.resetAllMocks(); mocks.authorize.mockReturnValue(true);
    mocks.transaction.mockImplementation(async callback => callback({}));
    mocks.findMany.mockResolvedValue([]);
  });
  it("rejects an unauthenticated request before reading records", async () => {
    mocks.authorize.mockReturnValue(false);
    expect((await POST(new Request("https://example.invalid"))).status).toBe(401);
    expect(mocks.findMany).not.toHaveBeenCalled();
  });
  it("continues past blocked records and uses serializable guarded publication", async () => {
    mocks.findMany.mockResolvedValueOnce([{ id: "a", organizationId: "org", createdById: "owner", version: 4 }])
      .mockResolvedValueOnce([{ id: "b", organizationId: "org", createdById: "owner", version: 5 }]).mockResolvedValue([]);
    mocks.transition.mockRejectedValueOnce(new Error("private failure")).mockResolvedValueOnce({});
    const response = await POST(new Request("https://example.invalid"));
    expect(await response.json()).toEqual({ inspected: 2, published: 1, blocked: 1 });
    expect(mocks.transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "Serializable" });
    expect(mocks.transition).toHaveBeenLastCalledWith({}, expect.objectContaining({ source: "SCHEDULED_JOB", expectedVersion: 5, actorUserId: "owner" }));
    expect(mocks.findMany.mock.calls[1][0].where.id).toEqual({ gt: "a" });
    expect(mocks.revalidate).toHaveBeenCalledWith("/careers");
  });
});
