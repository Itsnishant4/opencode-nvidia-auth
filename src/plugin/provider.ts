import type { PluginInput, Plugin } from "@opencode-ai/plugin";
import type { Provider, Model, Config } from "@opencode-ai/sdk";
import { NVIDIA_BASE_URL, getNvidiaHeaders } from "../constants.js";
import { IAccountManager, AccountManager } from "./accounts.js";

export class NvidiaProvider implements Provider {
    readonly id = "nvidia";
    readonly name = "NVIDIA";
    readonly source = "custom";
    readonly env: string[] = [];
    readonly models: Record<string, Model> = {};
    readonly options: Record<string, unknown> = {};

    constructor(
        private readonly context: PluginInput,
        private readonly accountManager: IAccountManager
    ) { }

    async loadModels(): Promise<Model[]> {
        const account = await this.accountManager.getNextAvailableAccount();
        if (!account) {
            throw new Error("No active NVIDIA API keys available.");
        }

        try {
            const resp = await fetch(`${NVIDIA_BASE_URL}/models`, {
                headers: {
                    Authorization: `Bearer ${account.apiKey}`,
                },
            });

            if (!resp.ok) {
                throw new Error(`Failed to fetch models: ${resp.statusText}`);
            }

            const data = await resp.json() as { data: { id: string }[] };
            // Map NVIDIA's OpenAI-compatible models format into OpenCode's format
            return data.data.map((m) => {
                const model: Model = {
                    id: m.id,
                    name: m.id,
                    providerID: "nvidia",
                    api: { id: "generateContent", url: NVIDIA_BASE_URL, npm: "" },
                    capabilities: {
                        temperature: true,
                        reasoning: false,
                        attachment: false,
                        toolcall: false,
                        input: { text: true, audio: false, image: false, video: false, pdf: false },
                        output: { text: true, audio: false, image: false, video: false, pdf: false }
                    },
                    cost: { input: 0, output: 0, cache: { read: 0, write: 0 } },
                    limit: { context: 32768, output: 4096 },
                    status: "active",
                    options: {},
                    headers: {}
                };
                return model;
            });
        } catch (err: any) {
            if (err.message.includes("429") || err.message.includes("RateLimit")) {
                this.accountManager.markRateLimited(account.apiKey);
                // Try one more time with another key if available
                return this.loadModels();
            }
            throw err;
        }
    }

    async generateContent(options: {
        model: string;
        messages: any[];
        systemInstruction?: string;
        temperature?: number;
        topP?: number;
    }): Promise<Response> {
        const account = await this.accountManager.getNextAvailableAccount();
        if (!account) {
            throw new Error("No available NVIDIA API keys found. Try running: opencode auth login");
        }

        // Prepare OpenAI compatible payload mapping for NVIDIA NIM API
        const payload = {
            model: options.model,
            messages: this.mapMessages(options.messages, options.systemInstruction),
            temperature: options.temperature,
            stream: true, // We will just proxy stream to open code directly
        };

        const url = `${NVIDIA_BASE_URL}/chat/completions`;

        const headers = getNvidiaHeaders(account.apiKey);

        // Using native fetch to make request mapping to OpenAI schema
        const response = await fetch(url, {
            method: "POST",
            headers,
            body: JSON.stringify(payload),
        });

        if (response.status === 429) {
            this.accountManager.markRateLimited(account.apiKey);
            // Let OpenCode handle the error, but we've marked this key so the next prompt tries another
            throw new Error("RATE_LIMIT: NVIDIA API key is rate limited. The next request will use another key if available.");
        }

        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                this.accountManager.markInvalid(account.apiKey);
            }
            throw new Error(`NVIDIA API Error: ${response.status} ${response.statusText}`);
        }

        return response;
    }

    private mapMessages(messages: any[], systemInstruction?: string) {
        const msgs = [];
        if (systemInstruction) {
            msgs.push({ role: "system", content: systemInstruction });
        }

        for (const m of messages) {
            // OpenCode plugins abstract specific structures, we handle basic text wrapping.
            msgs.push({
                role: m.role,
                // Depending on how opencode handles content parts, usually text is nested
                content: Array.isArray(m.parts) ? m.parts.map((p: any) => p.text).join("::") : m.content || m.text
            });
        }
        return msgs;
    }
}
