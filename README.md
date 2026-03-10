# NVIDIA NIM Auth Plugin for OpenCode

Enable OpenCode to authenticate against **NVIDIA NIM** APIs with multi-key support to utilize advanced models like `llama3-70b-instruct`, `mixtral-8x22b`, and `nemotron` alongside automatic key rotation and load-balancing.

This plugin is heavily styled after `opencode-antigravity-auth` but uses API keys to power the NVIDIA API catalog instead of Google OAuth.

## What You Get

- **All NVIDIA NIM Models** (Llama 3, Mistral, Gemma, Nemotron, etc.)
- **Multi-key support** — add multiple `nvapi-` keys, auto-rotates when rate-limited.
- **Round-Robin and Load Balancing** — transparently switches keys across conversations or when one key hits its quota limit (429 Rate Limit error).
- **Auto-recovery** — Handles broken instances silently behind the scenes.

## Installation

To install this plugin on a new machine:

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Itsnishant4/opencode-nvidia-auth.git
   cd opencode-nvidia-auth
   ```

2. **Install dependencies and build**:
   ```bash
   pnpm install
   pnpm build
   ```

3. **Link to OpenCode**:
   Add the **absolute path** of this directory to your `~/.config/opencode/opencode.json` file:

   ```json
   {
     "plugin": ["/path/to/your/cloned/opencode-nvidia-auth"]
   }
   ```

### Configuration

Add this model block to `~/.config/opencode/opencode.json` under your `provider` settings. You can add as many NVIDIA NIM models from the API catalog as you like using the same structure. Ensure `provider: "nvidia"` to route the requests properly.

<details open>
<summary><b>Full models configuration (copy-paste ready)</b></summary>

```json
{
  "provider": {
    "nvidia": {
      "models": {
        "meta/llama-3.1-405b-instruct": {
          "name": "Llama 3.1 405B Instruct (NVIDIA)",
          "limit": { "context": 128000, "output": 4096 },
          "modalities": { "input": ["text"], "output": ["text"] }
        },
        "meta/llama-3.1-70b-instruct": {
          "name": "Llama 3.1 70B Instruct (NVIDIA)",
          "limit": { "context": 128000, "output": 4096 },
          "modalities": { "input": ["text"], "output": ["text"] }
        },
        "meta/llama-3.1-8b-instruct": {
          "name": "Llama 3.1 8B Instruct (NVIDIA)",
          "limit": { "context": 128000, "output": 4096 },
          "modalities": { "input": ["text"], "output": ["text"] }
        },
        "mistralai/mixtral-8x22b-instruct-v0.1": {
          "name": "Mixtral 8x22B Instruct (NVIDIA)",
          "limit": { "context": 64000, "output": 4096 },
          "modalities": { "input": ["text"], "output": ["text"] }
        },
        "mistralai/mistral-large-2-instruct": {
          "name": "Mistral Large 2 (NVIDIA)",
          "limit": { "context": 128000, "output": 4096 },
          "modalities": { "input": ["text"], "output": ["text"] }
        },
        "google/gemma-2-27b-it": {
          "name": "Gemma 2 27B IT (NVIDIA)",
          "limit": { "context": 8192, "output": 4096 },
          "modalities": { "input": ["text"], "output": ["text"] }
        },
        "nvidia/nemotron-4-340b-instruct": {
          "name": "Nemotron-4 340B Instruct (NVIDIA)",
          "limit": { "context": 4096, "output": 1024 },
          "modalities": { "input": ["text"], "output": ["text"] }
        }
      }
    }
  }
}
```
</details>

## Multi-Account Setup

Add multiple API keys to increase your quotas or have backups in case one gets rate limited. The plugin stores keys in `~/.config/opencode/nvidia-accounts.json`.

```bash
# Add a new key
opencode auth login

# Check the status of your keys (enabled, disabled, invalid, rate-limited)
opencode auth status

# Remove a faulty or old key
opencode auth remove
```

## How It Works

1. The plugin wraps OpenCode's native networking with custom load balancing. 
2. When you start an OpenCode command (`opencode run "..." --model=nvidia/meta/llama-3.1-70b-instruct`), it securely picks a valid key from your configuration.
3. If NVIDIA NIM returns a `429 Too Many Requests` status, the plugin instantly marks the key as rate-limited, caching its timeout status, and transparently pulls the next valid key.
4. Accounts rotation follows the same multi-account strategy concept found in `opencode-antigravity-auth`.
