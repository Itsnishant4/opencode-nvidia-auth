import type { PluginInput, Plugin } from "@opencode-ai/plugin";
import { IAccountManager, AccountManager } from "./plugin/accounts.js";
import { NvidiaProvider } from "./plugin/provider.js";

export const NvidiaCLIOAuthPlugin: Plugin = async (context: PluginInput) => {
    const accountManager = await AccountManager.load();

    return {
        auth: {
            provider: "nvidia",
            loader: async (getAuth: () => Promise<any>, provider: any) => {
                const accountManager = await AccountManager.load();
                const account = await accountManager.getNextAvailableAccount();

                return {
                    apiKey: account?.apiKey || "",
                    async fetch(input: RequestInfo | URL, init?: RequestInit) {
                        const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

                        // Check if it's an NVIDIA NIM API request
                        if (url.includes("api.nvidia.com") || url.includes("nvidia/")) {
                            const account = await accountManager.getNextAvailableAccount();
                            if (!account) {
                                throw new Error("No available NVIDIA API keys found. Run 'opencode auth login --provider nvidia' to add one.");
                            }

                            // Clone headers and inject key
                            const headers = new Headers(init?.headers);
                            headers.set("Authorization", `Bearer ${account.apiKey}`);

                            const modifiedInit = {
                                ...init,
                                headers,
                            };

                            try {
                                const response = await fetch(input, modifiedInit);

                                if (response.status === 429) {
                                    accountManager.markRateLimited(account.apiKey);
                                    // Optionally retry with next key or just return the error
                                } else if (response.status === 401 || response.status === 403) {
                                    accountManager.markInvalid(account.apiKey);
                                }

                                return response;
                            } catch (error) {
                                throw error;
                            }
                        }

                        // Fallback to default fetch for other requests
                        return fetch(input, init);
                    }
                };
            },
            methods: [
                {
                    label: "Add or Manage NVIDIA API Keys",
                    type: "oauth",
                    authorize: async () => {
                        const accountManager = await AccountManager.load();
                        const { createInterface } = await import("node:readline/promises");
                        const { stdin, stdout } = await import("node:process");
                        const rl = createInterface({ input: stdin, output: stdout });

                        try {
                            while (true) {
                                const accounts = accountManager.getAccounts();
                                if (accounts.length === 0) {
                                    console.log("\nNo NVIDIA API keys configured.");
                                    const key = (await rl.question("Enter your NVIDIA API key (or leave blank to cancel): ")).trim();
                                    if (key) {
                                        accountManager.addAccount(key);
                                        await accountManager.save();
                                        console.log("Key added successfully.");
                                    } else {
                                        break;
                                    }
                                } else {
                                    console.log("\n=== NVIDIA API Key Management ===");
                                    accounts.forEach((acc: any, i: number) => {
                                        let status = "[OK]";
                                        if (acc.invalid) status = "[INVALID]";
                                        else if (acc.rateLimitUnblockAt && acc.rateLimitUnblockAt > Date.now()) {
                                            const waitSec = Math.ceil((acc.rateLimitUnblockAt - Date.now()) / 1000);
                                            status = `[RATE LIMITED] (Ready in ${waitSec}s)`;
                                        }

                                        let lastUsed = "";
                                        if (acc.lastUsedAt) {
                                            const diffSeconds = Math.floor((Date.now() - acc.lastUsedAt) / 1000);
                                            if (diffSeconds < 60) lastUsed = ` | used ${diffSeconds}s ago`;
                                            else if (diffSeconds / 60 < 60) lastUsed = ` | used ${Math.floor(diffSeconds / 60)}m ago`;
                                            else lastUsed = ` | used ${new Date(acc.lastUsedAt).toLocaleString()}`;
                                        }

                                        console.log(`${i + 1}. ${acc.apiKey.slice(0, 12)}... ${status}${lastUsed}`);
                                    });
                                    console.log("\nOptions:");
                                    console.log("a. Add another key");
                                    console.log("r. Remove a key");
                                    console.log("q. Done (Save and Return)");

                                    const choice = (await rl.question("\nChoice: ")).trim().toLowerCase();
                                    if (choice === "a" || choice === "add") {
                                        const key = (await rl.question("Enter new NVIDIA API key: ")).trim();
                                        if (key) {
                                            if (accountManager.addAccount(key)) {
                                                await accountManager.save();
                                                console.log("Key added.");
                                            } else {
                                                console.log("Key already exists.");
                                            }
                                        }
                                    } else if (choice === "r" || choice === "remove") {
                                        const idxStr = (await rl.question("Enter key number to remove: ")).trim();
                                        const idx = parseInt(idxStr) - 1;
                                        if (!isNaN(idx) && accountManager.removeAccount(idx)) {
                                            await accountManager.save();
                                            console.log("Key removed.");
                                        } else {
                                            console.log("Invalid number.");
                                        }
                                    } else if (choice === "q" || choice === "exit" || !choice) {
                                        break;
                                    }
                                }
                            }
                        } finally {
                            rl.close();
                        }

                        return {
                            url: "https://build.nvidia.com/nvidia/nim",
                            instructions: "Configuration complete. If you added keys, you can now use nvidia/ models. Just press Enter to finish the OpenCode auth flow.",
                            method: "auto",
                            callback: async () => {
                                const accountManager = await AccountManager.load();
                                const next = await accountManager.getNextAvailableAccount();
                                return {
                                    type: "success",
                                    refresh: next?.apiKey || "no-key",
                                    access: next?.apiKey || "no-key",
                                    expires: Date.now() + 3600 * 1000,
                                };
                            }
                        };
                    },
                }
            ],
        }
    };
};

export const NvidiaPlugin = NvidiaCLIOAuthPlugin;
