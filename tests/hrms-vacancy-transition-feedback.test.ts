import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ permission: vi.fn(), transaction: vi.fn(), transition: vi.fn(), revalidate: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("../src/lib/hr/permissions/authorize", () => ({ requirePermission: mocks.permission, requireAuthenticatedUser: vi.fn() }));
vi.mock("../src/lib/prisma", () => ({ prisma: { $transaction: mocks.transaction } }));
vi.mock("../src/lib/hr/recruitment/vacancies", () => ({ transitionVacancy: mocks.transition, createVacancy: vi.fn(), vacancyInput: {} }));
import { transitionVacancyWithStateAction } from "../src/app/hr/admin/vacancies/actions";

describe("vacancy transition database feedback", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.permission.mockResolvedValue({ user: { id: "creator", organizationId: "org" }, roles: ["HR_ADMIN"] });
    mocks.transaction.mockImplementation(async callback => callback({}));
  });
  function submit() {
    const form = new FormData();
    form.set("vacancyId", "clabcdefghijklmnopqrstuvw");
    form.set("expectedVersion", "3"); form.set("to", "OPEN"); form.set("reason", "Synthetic review");
    return transitionVacancyWithStateAction({ status: "idle" }, form);
  }
  it.each([
    ["P2034", undefined], ["P2010", "40001"], ["P2010", "40P01"], ["P2010", "55P03"],
  ])("explains %s/%s without database details or an automatic retry", async (code, sqlCode) => {
    mocks.transition.mockRejectedValue(Object.assign(new Error("private query and database details"), { code, meta: { code: sqlCode } }));
    expect(await submit()).toEqual({ status: "error", message: "The vacancy or its permissions changed while this action was running. Reload the page and try again." });
    expect(mocks.transition).toHaveBeenCalledTimes(1);
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
  it("hides other database errors without calling them permission conflicts", async () => {
    mocks.transition.mockRejectedValue(Object.assign(new Error("private database detail"), { code: "P2010", meta: { code: "99999" } }));
    expect(await submit()).toEqual({ status: "error", message: "The vacancy could not be updated. Reload the page and try again." });
  });
  it("preserves the existing business-rule explanation", async () => {
    mocks.transition.mockRejectedValue(new Error("The vacancy creator no longer has publication permission."));
    expect((await submit()).message).toBe("The vacancy creator no longer has publication permission.");
  });
  it("preserves successful submission", async () => {
    mocks.transition.mockResolvedValue({});
    expect(await submit()).toEqual({ status: "success", message: "Vacancy updated." });
    expect(mocks.transition).toHaveBeenCalledTimes(1);
  });
});
