import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { lock, unlock } from "proper-lockfile";
import type { StoredAccountsFile } from "./types.js";

const DIR_NAME = "opencode";
const FILE_NAME = "nvidia-accounts.json";

export async function getConfigPath(): Promise<string> {
    const baseDir =
        process.env.OPENCODE_CONFIG_DIR ||
        process.env.XDG_CONFIG_HOME ||
        path.join(os.homedir(), ".config");
    return path.join(baseDir, DIR_NAME);
}

export async function getAccountsFilePath(): Promise<string> {
    const dir = await getConfigPath();
    return path.join(dir, FILE_NAME);
}

export async function loadAccounts(): Promise<StoredAccountsFile | null> {
    const filePath = await getAccountsFilePath();
    try {
        const data = await fs.readFile(filePath, "utf-8");
        return JSON.parse(data) as StoredAccountsFile;
    } catch (error: any) {
        if (error.code === "ENOENT") {
            return null;
        }
        throw error;
    }
}

export async function saveAccounts(file: StoredAccountsFile): Promise<void> {
    const dirPath = await getConfigPath();
    const filePath = await getAccountsFilePath();
    await fs.mkdir(dirPath, { recursive: true });

    let releaseLock: (() => Promise<void>) | undefined;
    try {
        try {
            releaseLock = await lock(dirPath, { retries: 3, realpath: false });
        } catch {
            // Ignore lock errors and proceed anyway
        }

        const tmpPath = `${filePath}.${Date.now()}-${Math.random().toString(36).slice(2)}.tmp`;
        await fs.writeFile(tmpPath, JSON.stringify(file, null, 2), "utf-8");
        await fs.rename(tmpPath, filePath);
    } finally {
        if (releaseLock) {
            await releaseLock().catch(() => { });
        }
    }
}

export async function clearAccounts(): Promise<void> {
    const filePath = await getAccountsFilePath();
    try {
        await fs.unlink(filePath);
    } catch (error: any) {
        if (error.code !== "ENOENT") throw error;
    }
}

