// Pulls public content from an Obsidian vault to `src/content`.

import dotenv from "dotenv";
import Path from "@mojojs/path";
import pino from "pino";
import slugify from "slugify";

dotenv.config();

const allowedExtensions = [".md"];
const logger = pino({
    transport: {
        target: "pino-pretty",
    }
});

async function main() {
    logger.info("Pulling content from Obsidian vault...");
    const vaultPath = new Path(process.env.VAULT_PATH!);
    const contentPath = new Path(process.env.CONTENT_PATH!);
    const pullList = process.env.PULL_LIST!
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

    logger.info(`Vault path: ${vaultPath}`);
    logger.info(`Content path: ${contentPath}`);
    logger.info(`Pull list: ${pullList}`);

    for (const folder of pullList) {
        await pullDirectory(vaultPath, contentPath, folder);
    }
}

async function pullDirectory(vaultDir: Path, contentDir: Path, folder: string) {
    let count = 0;
    const folderDir = vaultDir.child(folder);

    for await (const file of folderDir.list({ recursive: true })) {
        const filePulled = await pullFile(vaultDir, contentDir, file);

        if (filePulled) {
            count++;
        }
    }
    logger.info(`Pulled ${count} files from ${folder}`);
}

async function canPullFile(vaultFile: Path) {
    const stat = await vaultFile.stat();

    if (!stat.isFile()) {
        return false;
    }

    const ext = vaultFile.extname();

    if (!allowedExtensions.includes(ext)) {
        logger.warn(`Cannot pull ${vaultFile}; ${ext} is not in ${allowedExtensions}.`);
        return false;
    }

    return true;
}

async function pullFile(vaultDir: Path, contentDir: Path, vaultFile: Path) {
    if (!await canPullFile(vaultFile)) {
        return false;
    }

    const contentSlugPath = vaultDir
        .relative(vaultFile)
        .toArray()
        .map((part) => slugify(part, { lower: true }))
        .join("/");
    logger.debug(`Relative path: ${contentSlugPath}`);
    const contentFile = contentDir.child(contentSlugPath);

    if (await contentFile.exists()) {
        logger.debug(`Skipping ${vaultFile} because ${contentFile} already exists.`);
        return false;
    }

    logger.info(`Copying ${vaultFile} to ${contentFile}`);

    await contentFile.dirname().mkdir({ recursive: true });
    await vaultFile.copyFile(contentFile);

    return true;
}

await main();