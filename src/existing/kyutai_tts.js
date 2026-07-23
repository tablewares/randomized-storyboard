import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFile } from "node:fs/promises";

const execFileP = promisify(execFile);

export async function synthesizeVoice({ text, outPath, voice }) {
  const url = "http://localhost:8000/tts";
  const selectedVoice = voice?.name || "george"; // Default voice if none provided
  if (!selectedVoice) {
    throw new Error("voice.name is required");
  }

  // Create multipart/form-data payload
  const formData = new FormData();
  formData.append("text", text);
  formData.append("voice_url", selectedVoice)
  formData.append("temperature", "0.8")
  formData.append("lsd_decode_steps", "5")
  formData.append("eos_threshold", "0")


  const res = await fetch(url, {
    method: "POST",
    // Note: Do NOT set Content-Type header manually here. 
    // Fetch automatically manages boundaries for FormData.
    
    body: formData,
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Local TTS failed (${res.status}): ${body}`);
  }

  // Convert response to buffer and save the file
  const arrayBuffer = await res.arrayBuffer();
  const buf = Buffer.from(arrayBuffer);
  await writeFile(outPath, buf);

  // Calculate and return duration if your helper supports .wav
  let durationSec = await getAudioDurationSec(outPath);

  return { outPath, durationSec };
}


/** Uses ffprobe (bundled with any ffmpeg install) to read exact audio duration. */
export async function getAudioDurationSec(filePath) {
  const { stdout } = await execFileP("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1",
    filePath,
  ]);
  return parseFloat(stdout.trim());
}
