#!/usr/bin/env node

import { execSync, spawn } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const HELP = `
Usage: node scripts/compress-videos.mjs [options] <input-dir>

Batch compress MP4 videos to 720p using FFmpeg.

Options:
  -o, --output-dir <dir>   Output directory (default: same as input, appends _720p)
  --crf <value>            CRF quality (0-51, default: 23, lower = better quality)
  --preset <name>          Encoding preset (default: medium)
  --height <pixels>        Target height (default: 720)
  --dry-run                Show commands without executing
  -h, --help               Show this help
`.trim();

function parseArgs(argv) {
	const args = argv.slice(2);
	const options = {
		inputDir: null,
		outputDir: null,
		crf: "23",
		preset: "medium",
		height: "720",
		dryRun: false,
	};

	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		if (arg === "-h" || arg === "--help") {
			console.log(HELP);
			process.exit(0);
		}
		if (arg === "-o" || arg === "--output-dir") {
			options.outputDir = args[++i];
		} else if (arg === "--crf") {
			options.crf = args[++i];
		} else if (arg === "--preset") {
			options.preset = args[++i];
		} else if (arg === "--height") {
			options.height = args[++i];
		} else if (arg === "--dry-run") {
			options.dryRun = true;
		} else if (!arg.startsWith("-")) {
			options.inputDir = arg;
		}
	}

	if (!options.inputDir) {
		console.error("Error: input directory is required.\n");
		console.log(HELP);
		process.exit(1);
	}

	return options;
}

function findFfmpeg() {
	const candidates =
		process.platform === "win32"
			? ["ffmpeg.exe", "ffmpeg"]
			: ["ffmpeg"];

	for (const cmd of candidates) {
		try {
			execSync(`${cmd} -version`, { stdio: "pipe" });
			return cmd;
		} catch {
			// continue
		}
	}

	// Check bundled ffmpeg-static
	const staticBin = path.join(
		process.cwd(),
		"node_modules",
		"ffmpeg-static",
		process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg",
	);
	if (existsSync(staticBin)) {
		return staticBin;
	}

	console.error("Error: ffmpeg not found. Install ffmpeg or run: npm run postinstall");
	process.exit(1);
}

function getVideoInfo(ffmpeg, filePath) {
	try {
		const output = execSync(`${ffmpeg} -i "${filePath}" 2>&1`, {
			encoding: "utf-8",
			timeout: 10000,
		});
		const match = output.match(/(\d{3,5})x(\d{3,5})/);
		if (match) {
			return { width: Number.parseInt(match[1], 10), height: Number.parseInt(match[2], 10) };
		}
	} catch {
		// ffprobe fallback or parse error
	}
	return null;
}

function formatSize(bytes) {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

async function compressFile(ffmpeg, inputPath, outputPath, options) {
	const info = getVideoInfo(ffmpeg, inputPath);
	const targetHeight = Number.parseInt(options.height, 10);

	if (info && info.height <= targetHeight) {
		return { skipped: true, reason: `already ${info.height}p` };
	}

	const vf = `scale=-2:${targetHeight}`;
	const cmd = [
		ffmpeg,
		"-i",
		`"${inputPath}"`,
		"-vf",
		vf,
		"-c:v",
		"libx264",
		"-crf",
		options.crf,
		"-preset",
		options.preset,
		"-c:a",
		"aac",
		"-b:a",
		"128k",
		"-loglevel",
		"error",
		"-y",
		`"${outputPath}"`,
	].join(" ");

	if (options.dryRun) {
		console.log(`  [dry-run] ${cmd}`);
		return { skipped: false, dryRun: true };
	}

	return new Promise((resolve, reject) => {
		const child = spawn(cmd, { shell: true, stdio: "inherit" });
		child.on("close", (code) => {
			if (code === 0) {
				resolve({ skipped: false });
			} else {
				reject(new Error(`ffmpeg exited with code ${code}`));
			}
		});
		child.on("error", reject);
	});
}

async function main() {
	const options = parseArgs(process.argv);
	const inputDir = path.resolve(options.inputDir);

	if (!existsSync(inputDir) || !statSync(inputDir).isDirectory()) {
		console.error(`Error: "${inputDir}" is not a valid directory.`);
		process.exit(1);
	}

	const outputDir = options.outputDir ? path.resolve(options.outputDir) : inputDir;

	const files = readdirSync(inputDir).filter(
		(f) => f.endsWith(".mp4") && !f.includes("_720p"),
	);

	if (files.length === 0) {
		console.log("No .mp4 files found to compress.");
		return;
	}

	const ffmpeg = findFfmpeg();
	const targetHeight = options.height;

	console.log(`Found ${files.length} video(s) to compress to ${targetHeight}p`);
	console.log(`Input:  ${inputDir}`);
	console.log(`Output: ${outputDir}`);
	console.log(`CRF: ${options.crf} | Preset: ${options.preset}`);
	if (options.dryRun) console.log("[dry-run mode]");
	console.log("---");

	let success = 0;
	let skipped = 0;
	let failed = 0;

	for (const file of files) {
		const inputPath = path.join(inputDir, file);
		const outputPath = path.join(outputDir, file.replace(".mp4", `_${targetHeight}p.mp4`));
		const inputSize = statSync(inputPath).size;

		console.log(`\n[${success + skipped + failed + 1}/${files.length}] ${file} (${formatSize(inputSize)})`);

		try {
			const result = await compressFile(ffmpeg, inputPath, outputPath, options);

			if (result.skipped) {
				console.log(`  Skipped: ${result.reason}`);
				skipped++;
				continue;
			}

			if (!result.dryRun && existsSync(outputPath)) {
				const outputSize = statSync(outputPath).size;
				const ratio = ((1 - outputSize / inputSize) * 100).toFixed(1);
				console.log(`  Done: ${formatSize(outputSize)} (${ratio}% smaller)`);
			}
			success++;
		} catch (err) {
			console.error(`  Failed: ${err.message}`);
			failed++;
		}
	}

	console.log("\n---");
	console.log(`Completed: ${success} compressed, ${skipped} skipped, ${failed} failed`);
}

await main();
