// Pulls public content from an Obsidian vault to `src/content`.

import dotenv from "dotenv";
import matter from "gray-matter";
import Path from "@mojojs/path";
import pino from "pino";
import slugify from "slugify";
import XRegexp from "xregexp";

dotenv.config();

type PullSettings = {
    vaultPath: Path;
    contentPath: Path;
    pullList: string[];
}

const allowedExtensions = [".md"];
const wikiLinkPattern = `
    \\[\\[
        (.+?)
        \\|
        (.+?)
    \\]\\]
`;

const logger = pino({
    transport: {
        target: "pino-pretty",
    }
});


async function main() {
    logger.info("Pulling content from Obsidian vault...");
    const pullSettings = loadPullSettings();

    for (const folder of pullSettings.pullList) {
        await pullDirectory(pullSettings, folder);
    }
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

async function loadNote(vaultDir: Path, vaultFile: Path) {
    const note = matter(await vaultFile.readFile("utf-8"));
    let contentElements = vaultDir.relative(vaultFile).toArray();
    const noteName = vaultFile.basename(vaultFile.extname());
    contentElements[contentElements.length - 1] = noteName;
    note.data.name = contentElements.join("/");

    let links: string[] = [];

    // Find all wiki links in the note.
    note.content = XRegexp.replace(note.content, XRegexp(wikiLinkPattern, "xg"), (...args) => {
        logger.info(`Found wiki link: ${JSON.stringify(args)}`);
        const [match, noteLink, alias, _] = args;
        const noteSlug = noteLink.toString().split("/").map((part) => slugify(part, { lower: true })).join("/");

        if (noteSlug.startsWith("inbox")) {
            return `*${alias}*`;
        }

        if (!noteLink) {
            logger.error(`Could not find note link in ${match}`)
            return match.toString();
        }

        links.push(noteLink.toString());

        const linkPath = new Path(noteLink.toString());
        const linkName = linkPath.basename(linkPath.extname());

        return `<a href="/${noteSlug}">${linkName}</a>`
    });

    logger.info(`Found ${links.length} Obsidian links in ${vaultFile}`);
    logger.info(`Links: ${JSON.stringify([...links])}`);
    note.data.links = links;

    if (!note.data.title) {
        note.data.title = noteName;
    }

    if (!note.data.slug) {
        note.data.slug = slugify(noteName, { lower: true });
    }

    logger.debug(`Note: ${JSON.stringify(note)}`);
    return note;
}

function loadPullSettings() {
    const vaultPath = new Path(process.env.VAULT_PATH!);
    const contentPath = new Path(process.env.CONTENT_PATH!);
    const pullList = process.env.PULL_LIST!
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

    logger.info(`Vault path: ${vaultPath}`);
    logger.info(`Content path: ${contentPath}`);
    logger.info(`Pull list: ${pullList}`);

    return {
        vaultPath,
        contentPath,
        pullList,
    };
}

async function pullDirectory(pullSettings: PullSettings, folder: string) {
    const { vaultPath } = pullSettings;
    let count = 0;
    const folderDir = vaultPath.child(folder);

    for await (const file of folderDir.list({ recursive: true })) {
        const filePulled = await pullFile(pullSettings, file);

        if (filePulled) {
            count++;
        }
    }
    logger.info(`Pulled ${count} files from ${folder}`);
}

async function pullFile(pullSettings: PullSettings, vaultFile: Path) {
    if (!await canPullFile(vaultFile)) {
        return false;
    }

    const { vaultPath, contentPath } = pullSettings;

    const note = await loadNote(vaultPath, vaultFile);

    let contentElements = vaultPath.relative(vaultFile).toArray();
    let slugParts = contentElements
        .map((part) => slugify(part, { lower: true }));

    if (note.data.slug) {
        // If the note has a slug, use that instead of the last part of the path.
        slugParts[slugParts.length - 1] = `${note.data.slug}.md`;
    }

    const contentSlugPath = slugParts.join("/");
    logger.debug(`Relative path: ${contentSlugPath}`);
    const contentFile = contentPath.child(contentSlugPath);

    // if (await contentFile.exists()) {
    //     logger.debug(`Skipping ${vaultFile} because ${contentFile} already exists.`);
    //     return false;
    // }

    logger.info(`Copying ${vaultFile} to ${contentFile}`);

    await contentFile.dirname().mkdir({ recursive: true });
    await contentFile.writeFile(matter.stringify(note.content, note.data));

    return true;
}

await main();