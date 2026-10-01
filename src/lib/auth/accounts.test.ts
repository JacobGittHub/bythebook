import { beforeEach, describe, expect, it, vi } from "vitest";
import { registerWithInvite, resetPasswordWithCode } from "./accounts";

const codes = vi.hoisted(() => ({
  claimAccessCode: vi.fn(),
  releaseAccessCode: vi.fn(),
  setAccessCodeUser: vi.fn(),
}));
const users = vi.hoisted(() => ({
  createConfirmedUser: vi.fn(),
  setUserPassword: vi.fn(),
}));

vi.mock("@/lib/db/accessCodes", () => codes);
vi.mock("@/lib/db/users", () => users);

const CODE = "AAAAA-BBBBB-CCCCC-DDDDD";
const registration = { code: CODE, email: "a@example.com", password: "password1", username: "a" };

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  codes.releaseAccessCode.mockResolvedValue(undefined);
  codes.setAccessCodeUser.mockResolvedValue(undefined);
  users.setUserPassword.mockResolvedValue(undefined);
});

describe("registerWithInvite", () => {
  it("creates the account and links the code to it", async () => {
    codes.claimAccessCode.mockResolvedValue({ userId: null });
    users.createConfirmedUser.mockResolvedValue("user-1");
    expect(await registerWithInvite(registration)).toBe("ok");
    expect(codes.claimAccessCode).toHaveBeenCalledWith(CODE, "invite");
    expect(codes.setAccessCodeUser).toHaveBeenCalledWith(CODE, "user-1");
    expect(codes.releaseAccessCode).not.toHaveBeenCalled();
  });

  it("creates nothing when the code can't be claimed", async () => {
    codes.claimAccessCode.mockResolvedValue(null);
    expect(await registerWithInvite(registration)).toBe("bad_code");
    expect(users.createConfirmedUser).not.toHaveBeenCalled();
    expect(codes.releaseAccessCode).not.toHaveBeenCalled();
  });

  it("fails without creating anything when the code can't be checked", async () => {
    codes.claimAccessCode.mockRejectedValue(new Error("offline"));
    expect(await registerWithInvite(registration)).toBe("failed");
    expect(users.createConfirmedUser).not.toHaveBeenCalled();
    expect(codes.releaseAccessCode).not.toHaveBeenCalled();
  });

  it("releases the code when the account can't be created", async () => {
    codes.claimAccessCode.mockResolvedValue({ userId: null });
    users.createConfirmedUser.mockRejectedValue(new Error("email taken"));
    expect(await registerWithInvite(registration)).toBe("failed");
    expect(codes.releaseAccessCode).toHaveBeenCalledWith(CODE);
    expect(codes.setAccessCodeUser).not.toHaveBeenCalled();
  });

  it("still succeeds when only the link to the account fails", async () => {
    codes.claimAccessCode.mockResolvedValue({ userId: null });
    users.createConfirmedUser.mockResolvedValue("user-1");
    codes.setAccessCodeUser.mockRejectedValue(new Error("offline"));
    expect(await registerWithInvite(registration)).toBe("ok");
    expect(codes.releaseAccessCode).not.toHaveBeenCalled();
  });
});

describe("resetPasswordWithCode", () => {
  const reset = { code: CODE, password: "new-password" };

  it("sets the password on the code's account", async () => {
    codes.claimAccessCode.mockResolvedValue({ userId: "user-1" });
    expect(await resetPasswordWithCode(reset)).toBe("ok");
    expect(codes.claimAccessCode).toHaveBeenCalledWith(CODE, "reset");
    expect(users.setUserPassword).toHaveBeenCalledWith("user-1", "new-password");
  });

  it("changes nothing when the code can't be claimed", async () => {
    codes.claimAccessCode.mockResolvedValue(null);
    expect(await resetPasswordWithCode(reset)).toBe("bad_code");
    expect(users.setUserPassword).not.toHaveBeenCalled();
  });

  it("fails without changing anything when the code can't be checked", async () => {
    codes.claimAccessCode.mockRejectedValue(new Error("offline"));
    expect(await resetPasswordWithCode(reset)).toBe("failed");
    expect(users.setUserPassword).not.toHaveBeenCalled();
  });

  it("releases the code when the password can't be set", async () => {
    codes.claimAccessCode.mockResolvedValue({ userId: "user-1" });
    users.setUserPassword.mockRejectedValue(new Error("weak password"));
    expect(await resetPasswordWithCode(reset)).toBe("failed");
    expect(codes.releaseAccessCode).toHaveBeenCalledWith(CODE);
  });
});
