import type { StoredAccount } from "./types.js";
import { loadAccounts, saveAccounts } from "./storage.js";

export interface IAccountManager {
    getAccounts(): StoredAccount[];
    getEnabledAccounts(): StoredAccount[];
    addAccount(apiKey: string, label?: string): boolean;
    removeAccount(index: number): boolean;
    save(): Promise<void>;
    markRateLimited(apiKey: string, blockDurationMs?: number): void;
    markInvalid(apiKey: string): void;
    useAccount(apiKey: string): Promise<void>;
    getNextAvailableAccount(): Promise<StoredAccount | null>;
}

export function createAccountManager(initialAccounts: StoredAccount[] = []): IAccountManager {
    let accounts: StoredAccount[] = [...initialAccounts];

    const self: IAccountManager = {
        getAccounts() {
            return accounts;
        },

        getEnabledAccounts() {
            return accounts.filter((a) => a.enabled && !a.invalid);
        },

        addAccount(apiKey: string, label?: string) {
            if (accounts.some((a) => a.apiKey === apiKey)) {
                return false;
            }
            accounts.push({
                apiKey,
                label,
                addedAt: Date.now(),
                enabled: true,
            });
            return true;
        },

        removeAccount(index: number) {
            if (index >= 0 && index < accounts.length) {
                accounts.splice(index, 1);
                return true;
            }
            return false;
        },

        async save() {
            await saveAccounts({ accounts });
        },

        markRateLimited(apiKey: string, blockDurationMs = 60000) {
            const acc = accounts.find((a) => a.apiKey === apiKey);
            if (acc) {
                acc.rateLimitUnblockAt = Date.now() + blockDurationMs;
                self.save().catch((e) => console.error("Failed to save rate limit status", e));
            }
        },

        markInvalid(apiKey: string) {
            const acc = accounts.find((a) => a.apiKey === apiKey);
            if (acc) {
                acc.invalid = true;
                acc.enabled = false;
                self.save().catch((e) => console.error("Failed to save invalid account status", e));
            }
        },

        async useAccount(apiKey: string) {
            const acc = accounts.find((a) => a.apiKey === apiKey);
            if (acc) {
                acc.lastUsedAt = Date.now();
                await self.save();
            }
        },

        async getNextAvailableAccount() {
            const now = Date.now();
            for (const acc of accounts) {
                if (acc.rateLimitUnblockAt && now > acc.rateLimitUnblockAt) {
                    acc.rateLimitUnblockAt = undefined;
                }
            }

            const available = accounts.filter(
                (a) => a.enabled && !a.invalid && !a.rateLimitUnblockAt
            );

            if (available.length === 0) {
                return null;
            }

            // Simple round-robin approach: pick one and mark as used
            const account = available[Math.floor(Math.random() * available.length)];
            await self.useAccount(account.apiKey);
            return account;
        }
    };

    return self;
}

export const AccountManager = {
    load: async (): Promise<IAccountManager> => {
        const data = await loadAccounts();
        return createAccountManager(data?.accounts || []);
    }
};
