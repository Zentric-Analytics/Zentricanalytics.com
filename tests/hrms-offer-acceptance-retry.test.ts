import { expect, it, vi } from "vitest";
import { withOfferAcceptanceRetry } from "../src/lib/hr/recruitment/acceptance-retry";

it.each([{ code: "P2034" }, { code: "P2010", meta: { code: "40001" } }, { code: "P2010", meta: { code: "40P01" } }])("retries a transaction abort %j", async error => {
  const operation = vi.fn().mockRejectedValueOnce(error).mockResolvedValue("original acceptance");
  expect(await withOfferAcceptanceRetry(operation)).toBe("original acceptance");
  expect(operation).toHaveBeenCalledTimes(2);
});
it("stops after three failed attempts", async () => {
  const error = { code: "P2034" };
  const operation = vi.fn().mockRejectedValue(error);
  await expect(withOfferAcceptanceRetry(operation)).rejects.toBe(error);
  expect(operation).toHaveBeenCalledTimes(3);
});
it.each([new Error("denied"), { code: "P2002" }, { code: "P2010", meta: { code: "23505" } }])("does not retry other errors %j", async error => {
  const operation = vi.fn().mockRejectedValue(error);
  await expect(withOfferAcceptanceRetry(operation)).rejects.toBe(error);
  expect(operation).toHaveBeenCalledTimes(1);
});
