import { constants as fsConstants } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { execFile, spawnSync } from "node:child_process";
import { promisify } from "node:util";
import { app } from "electron";
import { getFfmpegBinaryPath } from "../ffmpeg/binary";
import { getBundledWhisperExecutableCandidates } from "../paths/binaries";
import { parseWhisperJsonCues, parseSrtCues, shouldRetryWhisperWithoutJson } from "./parser";
import { normalizeVideoSourcePath } from "../utils";
import type { CaptionCuePayload } from "../types";
import { resolveRecordingSession } from "../project/session";

const execFileAsync = promisify(execFile);

export async function ensureReadableFile(filePath: string, options?: { executable?: boolean }) {
	await fs.access(filePath, fsConstants.R_OK);
	if (options?.executable) {
		try {
			await fs.access(filePath, fsConstants.X_OK);
		} catch {
			throw new Error("The selected Whisper executable is not marked as executable.");
		}
	}
}

export async function isExecutableFile(filePath: string) {
	try {
		await fs.access(filePath, fsConstants.R_OK | fsConstants.X_OK);
		return true;
	} catch {
		return false;
	}
}

export async function resolveWhisperExecutablePath(preferredPath?: string | null) {
	const candidatePaths = [
		preferredPath?.trim() || null,
		...getBundledWhisperExecutableCandidates(),
		process.env["WHISPER_CPP_PATH"]?.trim() || null,
		process.platform === "darwin" ? "/opt/homebrew/bin/whisper-cli" : null,
		process.platform === "darwin" ? "/usr/local/bin/whisper-cli" : null,
		process.platform === "darwin" ? "/opt/homebrew/bin/whisper-cpp" : null,
		process.platform === "darwin" ? "/usr/local/bin/whisper-cpp" : null,
	].filter((value): value is string => Boolean(value));

	for (const candidate of candidatePaths) {
		const normalized = path.resolve(candidate);
		if (await isExecutableFile(normalized)) {
			return normalized;
		}
	}

	const pathCommand = process.platform === "win32" ? "where" : "which";
	const binaryNames =
		process.platform === "win32"
			? ["whisper-cli.exe", "whisper.exe", "main.exe"]
			: ["whisper-cli", "whisper-cpp", "whisper", "main"];

	for (const binaryName of binaryNames) {
		const result = spawnSync(pathCommand, [binaryName], { encoding: "utf-8" });
		if (result.status === 0) {
			const resolvedPath = result.stdout
				.split(/\r?\n/)
				.map((line) => line.trim())
				.find(Boolean);

			if (resolvedPath && (await isExecutableFile(resolvedPath))) {
				return resolvedPath;
			}
		}
	}

	throw new Error(
		"未找到 Whisper 运行时。Vecord 已检查内置二进制文件及常见系统安装路径，均未找到。",
	);
}

export async function resolveCaptionAudioCandidates(videoPath: string) {
	const candidates: Array<{ path: string; label: string }> = [];
	const seenPaths = new Set<string>();

	const pushCandidate = (candidatePath: string | null | undefined, label: string) => {
		const normalizedCandidatePath = normalizeVideoSourcePath(candidatePath);
		if (!normalizedCandidatePath || seenPaths.has(normalizedCandidatePath)) {
			return;
		}

		seenPaths.add(normalizedCandidatePath);
		candidates.push({ path: normalizedCandidatePath, label });
	};

	pushCandidate(videoPath, "recording");

	const requestedRecordingSession = await resolveRecordingSession(videoPath);
	pushCandidate(requestedRecordingSession?.webcamPath, "linked webcam recording");

	return candidates;
}

export async function extractCaptionAudioSource(options: {
	videoPath: string;
	ffmpegPath: string;
	wavPath: string;
}) {
	const candidates = await resolveCaptionAudioCandidates(options.videoPath);
	const attemptedCandidates: Array<{
		path: string;
		label: string;
		readable: boolean;
		extractedAudio: boolean;
		error?: string;
	}> = [];

	for (const candidate of candidates) {
		try {
			await ensureReadableFile(candidate.path);
			await execFileAsync(
				options.ffmpegPath,
				[
					"-y",
					"-i",
					candidate.path,
					"-map",
					"0:a:0",
					"-vn",
					"-ac",
					"1",
					"-ar",
					"16000",
					"-c:a",
					"pcm_s16le",
					options.wavPath,
				],
				{ timeout: 5 * 60 * 1000, maxBuffer: 20 * 1024 * 1024 },
			);
			attemptedCandidates.push({ ...candidate, readable: true, extractedAudio: true });
			return candidate;
		} catch (error) {
			attemptedCandidates.push({
				...candidate,
				readable: true,
				extractedAudio: false,
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}

	console.warn(
		"[auto-captions] No audio source candidate could be extracted:",
		attemptedCandidates,
	);

	throw new Error(
		"No audio was found to transcribe in the saved recording file. Captions need an audio track. If this recording should have contained sound, the recording was saved without an audio stream.",
	);
}

interface ClipSegment {
	startMs: number;
	endMs: number;
}

/** Extracts kept clip segments from source audio and concatenates them into a single WAV. */
async function extractAndConcatClipAudio(options: {
	sourcePath: string;
	ffmpegPath: string;
	clips: ClipSegment[];
	outputWavPath: string;
}): Promise<Array<{ sourceStartMs: number; sourceEndMs: number; concatOffsetMs: number }>> {
	const { sourcePath, ffmpegPath, clips, outputWavPath } = options;
	const sorted = [...clips].sort((a, b) => a.startMs - b.startMs);

	if (sorted.length === 0) {
		// No clips — extract full audio unchanged
		await execFileAsync(
			ffmpegPath,
			["-y", "-i", sourcePath, "-map", "0:a:0", "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", outputWavPath],
			{ timeout: 5 * 60 * 1000, maxBuffer: 20 * 1024 * 1024 },
		);
		return [];
	}

	// Extract each segment to a temp file
	const tempDir = path.dirname(outputWavPath);
	const segmentPaths: string[] = [];
	const mapping: Array<{ sourceStartMs: number; sourceEndMs: number; concatOffsetMs: number }> = [];
	let concatOffsetMs = 0;

	try {
		for (let i = 0; i < sorted.length; i++) {
			const clip = sorted[i];
			const durationMs = clip.endMs - clip.startMs;
			if (durationMs <= 0) continue;

			const segPath = path.join(tempDir, `seg-${i}-${Date.now()}.wav`);

			await execFileAsync(
				ffmpegPath,
				[
					"-y",
					"-ss", String(clip.startMs / 1000),
					"-t", String(durationMs / 1000),
					"-i", sourcePath,
					"-map", "0:a:0",
					"-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le",
					segPath,
				],
				{ timeout: 5 * 60 * 1000, maxBuffer: 20 * 1024 * 1024 },
			);

			segmentPaths.push(segPath);
			mapping.push({ sourceStartMs: clip.startMs, sourceEndMs: clip.endMs, concatOffsetMs });
			concatOffsetMs += durationMs;
		}

		if (segmentPaths.length === 1) {
			// Only one segment — no need to concat, just rename
			await fs.rename(segmentPaths[0], outputWavPath);
			segmentPaths.length = 0; // already moved
		} else {
			// Build FFmpeg concat list file
			const listPath = path.join(tempDir, `concat-list-${Date.now()}.txt`);
			const listContent = segmentPaths.map((p) => `file "${p.replace(/\\/g, "/")}"`).join("\n");
			await fs.writeFile(listPath, listContent, "utf-8");

			try {
				await execFileAsync(
					ffmpegPath,
					["-y", "-f", "concat", "-safe", "0", "-i", listPath, "-c", "copy", outputWavPath],
					{ timeout: 5 * 60 * 1000, maxBuffer: 20 * 1024 * 1024 },
				);
			} finally {
				await fs.rm(listPath, { force: true });
			}
		}
	} finally {
		await Promise.allSettled(segmentPaths.map((p) => fs.rm(p, { force: true })));
	}

	return mapping;
}

interface ConcatMapping {
	sourceStartMs: number;
	sourceEndMs: number;
	concatOffsetMs: number;
}

function remapCuesToSourceTime(
	cues: CaptionCuePayload[],
	mapping: ConcatMapping[],
): CaptionCuePayload[] {
	if (mapping.length === 0) return cues; // no clips passed — full audio, no remap needed

	const result: CaptionCuePayload[] = [];
	for (const cue of cues) {
		// Find which concat segment this cue's midpoint falls in
		const midMs = (cue.startMs + cue.endMs) / 2;
		const segment = mapping.find((seg) => {
			const segDurationMs = seg.sourceEndMs - seg.sourceStartMs;
			const segEndConcatMs = seg.concatOffsetMs + segDurationMs;
			return midMs >= seg.concatOffsetMs && midMs < segEndConcatMs;
		});
		if (!segment) continue; // cue is in a trimmed gap — skip

		const offset = segment.sourceStartMs - segment.concatOffsetMs;
		const newStart = Math.max(segment.sourceStartMs, Math.round(cue.startMs + offset));
		const newEnd = Math.min(segment.sourceEndMs, Math.round(cue.endMs + offset));
		if (newEnd <= newStart) continue;

		result.push({
			...cue,
			startMs: newStart,
			endMs: newEnd,
			words: cue.words?.map((w) => ({
				...w,
				startMs: Math.max(newStart, Math.round(w.startMs + offset)),
				endMs: Math.min(newEnd, Math.round(w.endMs + offset)),
			})),
		});
	}
	return result;
}

export async function generateAutoCaptionsFromVideo(options: {
	videoPath: string;
	whisperExecutablePath?: string;
	whisperModelPath: string;
	language?: string;
	extraAudioRegions?: Array<{ path: string; startMs: number; endMs: number }>;
	clipRegions?: Array<{ startMs: number; endMs: number }>;
}) {
	const ffmpegPath = getFfmpegBinaryPath();
	const normalizedVideoPath = normalizeVideoSourcePath(options.videoPath);
	if (!normalizedVideoPath) {
		throw new Error("Missing source video path.");
	}

	const whisperExecutablePath = await resolveWhisperExecutablePath(options.whisperExecutablePath);
	const whisperModelPath = path.resolve(options.whisperModelPath);
	await ensureReadableFile(whisperExecutablePath, { executable: true });
	await ensureReadableFile(whisperModelPath);

	const language =
		options.language && options.language.trim() ? options.language.trim() : "auto";

	// If audio layers exist, transcribe each one separately with its time offset
	const audioRegions = (options.extraAudioRegions ?? []).filter((r) => r.path);
	if (audioRegions.length > 0) {
		const allCues: CaptionCuePayload[] = [];
		for (const region of audioRegions) {
			const tempBase = path.join(
				app.getPath("temp"),
				`recordly-captions-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
			);
			const wavPath = `${tempBase}.wav`;
			const outputBase = `${tempBase}-whisper`;
			const srtPath = `${outputBase}.srt`;
			const jsonPath = `${outputBase}.json`;
			try {
				await execFileAsync(
					ffmpegPath,
					["-y", "-i", region.path, "-map", "0:a:0", "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", wavPath],
					{ timeout: 5 * 60 * 1000, maxBuffer: 20 * 1024 * 1024 },
				);
				const whisperBaseArgs = ["-m", whisperModelPath, "-f", wavPath, "-osrt", "-of", outputBase, "-l", language, "-np"];
				let jsonEnabled = true;
				try {
					await execFileAsync(whisperExecutablePath, [...whisperBaseArgs, "-ojf"], {
						timeout: 30 * 60 * 1000,
						maxBuffer: 20 * 1024 * 1024,
					});
				} catch (error) {
					if (!shouldRetryWhisperWithoutJson(error)) throw error;
					jsonEnabled = false;
					await execFileAsync(whisperExecutablePath, whisperBaseArgs, {
						timeout: 30 * 60 * 1000,
						maxBuffer: 20 * 1024 * 1024,
					});
				}
				const timedCues = jsonEnabled
					? parseWhisperJsonCues(await fs.readFile(jsonPath, "utf-8"))
					: [];
				const cues = timedCues.length > 0 ? timedCues : parseSrtCues(await fs.readFile(srtPath, "utf-8"));
				// Shift cue timestamps by the region's startMs
				for (const cue of cues) {
					allCues.push({
						...cue,
						startMs: cue.startMs + region.startMs,
						endMs: cue.endMs + region.startMs,
					});
				}
			} finally {
				await Promise.allSettled([
					fs.rm(wavPath, { force: true }),
					fs.rm(srtPath, { force: true }),
					fs.rm(jsonPath, { force: true }),
				]);
			}
		}
		if (allCues.length === 0) {
			throw new Error("Whisper completed, but no caption cues were produced.");
		}
		allCues.sort((a, b) => a.startMs - b.startMs);
		return { cues: allCues, audioSourceLabel: "audio layer" };
	}

	// Fallback: use the video/webcam audio source
	const tempBase = path.join(
		app.getPath("temp"),
		`recordly-captions-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
	);
	const wavPath = `${tempBase}.wav`;
	const outputBase = `${tempBase}-whisper`;
	const srtPath = `${outputBase}.srt`;
	const jsonPath = `${outputBase}.json`;

	try {
		let audioSourceLabel: string;
		let concatMapping: Array<{ sourceStartMs: number; sourceEndMs: number; concatOffsetMs: number }>;

		if (options.clipRegions && options.clipRegions.length > 0) {
			// Resolve source path without a full FFmpeg extraction pass
			const candidates = await resolveCaptionAudioCandidates(normalizedVideoPath);
			const sourcePath = candidates[0]?.path;
			if (!sourcePath) {
				throw new Error("No audio source found for clip-aware extraction.");
			}
			await ensureReadableFile(sourcePath);
			audioSourceLabel = "recording";
			concatMapping = await extractAndConcatClipAudio({
				sourcePath,
				ffmpegPath,
				clips: options.clipRegions,
				outputWavPath: wavPath,
			});
		} else {
			const audioSource = await extractCaptionAudioSource({
				videoPath: normalizedVideoPath,
				ffmpegPath,
				wavPath,
			});
			audioSourceLabel = audioSource.label;
			concatMapping = [];
		}

		const whisperBaseArgs = [
			"-m",
			whisperModelPath,
			"-f",
			wavPath,
			"-osrt",
			"-of",
			outputBase,
			"-l",
			language,
			"-np",
		];

		let jsonEnabled = true;
		try {
			await execFileAsync(whisperExecutablePath, [...whisperBaseArgs, "-ojf"], {
				timeout: 30 * 60 * 1000,
				maxBuffer: 20 * 1024 * 1024,
			});
		} catch (error) {
			if (!shouldRetryWhisperWithoutJson(error)) {
				throw error;
			}

			jsonEnabled = false;
			console.warn(
				"[auto-captions] Whisper runtime does not support JSON full output, retrying with SRT only:",
				error,
			);
			await execFileAsync(whisperExecutablePath, whisperBaseArgs, {
				timeout: 30 * 60 * 1000,
				maxBuffer: 20 * 1024 * 1024,
			});
		}

		const timedCues = jsonEnabled
			? parseWhisperJsonCues(await fs.readFile(jsonPath, "utf-8"))
			: [];
		const rawCues =
			timedCues.length > 0 ? timedCues : parseSrtCues(await fs.readFile(srtPath, "utf-8"));
		if (rawCues.length === 0) {
			throw new Error("Whisper completed, but no caption cues were produced.");
		}
		const cues = remapCuesToSourceTime(rawCues, concatMapping);

		return {
			cues,
			audioSourceLabel,
		};
	} finally {
		await Promise.allSettled([
			fs.rm(wavPath, { force: true }),
			fs.rm(srtPath, { force: true }),
			fs.rm(jsonPath, { force: true }),
		]);
	}
}
