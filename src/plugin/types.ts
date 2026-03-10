import type { PluginInput } from "@opencode-ai/plugin";

export type StoredAccount = {
    apiKey: string;
    label?: string;
    addedAt: number;
    lastUsedAt?: number;
    enabled: boolean;
    rateLimitUnblockAt?: number;
    invalid?: boolean;
};

export type StoredAccountsFile = {
    accounts: StoredAccount[];
};

export type PluginClient = any; // Just bypass this type since client isn't passed this way anymore
