// Pulls public content from an Obsidian vault to `src/content`.

import dotenv from "dotenv";
import pino from "pino";

dotenv.config();

const logger = pino({
    transport: {
        target: "pino-pretty",
    }
});

function main() {
    logger.info("Pulling content from Obsidian vault...");
    const vaultPath = process.env.VAULT_PATH!;
    const contentPath = process.env.CONTENT_PATH!;
    const pullList = process.env.PULL_LIST!
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

    logger.info(`Vault path: ${vaultPath}`);
    logger.info(`Content path: ${contentPath}`);
    logger.info(`Pull list: ${pullList}`);
}

main();