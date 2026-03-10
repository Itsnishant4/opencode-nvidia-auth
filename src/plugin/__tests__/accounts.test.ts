import { describe, it, expect } from "vitest";
import { AccountManager } from "../accounts.js";
import type { StoredAccount } from "../types.js";

describe("AccountManager", () => {
    it("should return the next available account in round-robin fashion", () => {
        const accounts: StoredAccount[] = [
            { apiKey: "key1", addedAt: Date.now(), enabled: true },
            { apiKey: "key2", addedAt: Date.now(), enabled: true },
        ];
        const manager = new AccountManager(accounts);

        expect(manager.getNextAvailableAccount()?.apiKey).toBeDefined();
        expect(manager.getNextAvailableAccount()?.apiKey).toBeDefined();
    });

    it("should skip disabled or invalid accounts", () => {
        const accounts: StoredAccount[] = [
            { apiKey: "key1", addedAt: Date.now(), enabled: false },
            { apiKey: "key2", addedAt: Date.now(), enabled: true, invalid: true },
            { apiKey: "key3", addedAt: Date.now(), enabled: true },
        ];
        const manager = new AccountManager(accounts);

        expect(manager.getNextAvailableAccount()?.apiKey).toBe("key3");
    });

    it("should handle rate limits", () => {
        const unblockTime = Date.now() + 10000;
        const accounts: StoredAccount[] = [
            { apiKey: "key1", addedAt: Date.now(), enabled: true, rateLimitUnblockAt: unblockTime },
            { apiKey: "key2", addedAt: Date.now(), enabled: true },
        ];
        const manager = new AccountManager(accounts);

        // Should return key2 because key1 is rate limited
        expect(manager.getNextAvailableAccount()?.apiKey).toBe("key2");
    });

    it("should mark accounts as rate limited", () => {
        const accounts: StoredAccount[] = [
            { apiKey: "key1", addedAt: Date.now(), enabled: true },
        ];
        const manager = new AccountManager(accounts);

        manager.markRateLimited("key1");

        const account = manager.getNextAvailableAccount();
        expect(account).toBeNull(); // No keys available because key1 is limited
    });
});
