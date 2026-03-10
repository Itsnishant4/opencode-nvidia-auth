export const NVIDIA_PROVIDER_ID = "nvidia";
export const NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1";

export function getNvidiaHeaders(apiKey: string): Record<string, string> {
    return {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Accept": "text/event-stream"
    };
}
