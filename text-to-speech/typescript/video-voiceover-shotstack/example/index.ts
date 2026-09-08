import "dotenv/config";
import { createReadStream } from "fs";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

const text =
  process.argv.slice(2).join(" ") ||
  "Welcome to 12 Seaview Road. Three bedrooms of morning light, and the beach a five-minute walk away.";

// Production environment. For free watermarked test renders, change "v1"
// to "stage" and use your sandbox API key.
const SHOTSTACK_EDIT = "https://api.shotstack.io/edit/v1";
const SHOTSTACK_INGEST = "https://api.shotstack.io/ingest/v1";
const FOOTAGE =
  "https://shotstack-assets.s3.amazonaws.com/footage/city-timelapse.mp4";

const shotstackHeaders = {
  "x-api-key": process.env.SHOTSTACK_API_KEY ?? "",
  Accept: "application/json",
};

const presetVoiceId = process.env.ELEVENLABS_VOICE_ID || "JBFqnCBsd6RMkjVDRZzb";
const voiceSample = process.env.ELEVENLABS_VOICE_SAMPLE;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

try {
  if (!process.env.SHOTSTACK_API_KEY) {
    throw new Error("Set SHOTSTACK_API_KEY in .env first.");
  }
  if (!process.env.ELEVENLABS_API_KEY) {
    throw new Error("Set ELEVENLABS_API_KEY in .env first.");
  }
  const client = new ElevenLabsClient();

  // 1. Optionally clone a voice from a local sample, then generate the voice-over
  let voiceId = presetVoiceId;
  if (voiceSample) {
    const ivc = await client.voices.ivc.create({
      name: "Example cloned voice",
      files: [createReadStream(voiceSample)],
    });
    voiceId = ivc.voiceId;
    console.log("\u2713 Voice cloned with ElevenLabs");
  }

  const audio = await client.textToSpeech.convert(voiceId, {
    text,
    modelId: "eleven_multilingual_v2",
    outputFormat: "mp3_44100_128",
  });
  const chunks: Uint8Array[] = [];
  for await (const chunk of audio) {
    chunks.push(chunk);
  }
  const buffer = Buffer.concat(chunks);
  console.log("✓ Voice-over generated with ElevenLabs");

  // 2. Upload the audio to Shotstack (signed URL, no hosting needed)
  const uploadRes = await fetch(`${SHOTSTACK_INGEST}/upload`, {
    method: "POST",
    headers: shotstackHeaders,
  });
  if (!uploadRes.ok) {
    throw new Error(
      `Shotstack upload request failed (${uploadRes.status}): ${await uploadRes.text()}`
    );
  }
  const upload = (await uploadRes.json()).data;
  const putRes = await fetch(upload.attributes.url, {
    method: "PUT",
    body: buffer,
  });
  if (!putRes.ok) {
    throw new Error(
      `Uploading the voice-over to Shotstack failed (${putRes.status}).`
    );
  }

  let voiceoverUrl = "";
  const uploadDeadline = Date.now() + 60000;
  while (!voiceoverUrl) {
    if (Date.now() > uploadDeadline) {
      throw new Error("Timed out waiting for Shotstack to ingest the voice-over.");
    }
    await sleep(2000);
    const sourceRes = await fetch(
      `${SHOTSTACK_INGEST}/sources/${upload.id}`,
      { headers: shotstackHeaders }
    );
    if (!sourceRes.ok) {
      throw new Error(
        `Checking the upload status failed (${sourceRes.status}): ${await sourceRes.text()}`
      );
    }
    const attributes = (await sourceRes.json()).data?.attributes ?? {};
    if (attributes.status === "failed") {
      throw new Error("Shotstack could not ingest the voice-over file.");
    }
    voiceoverUrl = attributes.source ?? "";
  }
  console.log("✓ Voice-over uploaded to Shotstack");

  // 3. Render the video: captions on top, voice in the middle, footage below
  const edit = {
    timeline: {
      tracks: [
        {
          clips: [
            {
              asset: {
                type: "rich-caption",
                src: "alias://voiceover",
                font: { size: 36, color: "#ffffff" },
                padding: 16,
                background: {
                  color: "#000000",
                  opacity: 0.6,
                  borderRadius: 8,
                },
              },
              start: 0,
              length: "end",
              width: 960,
              height: 150,
              fit: "none",
              position: "bottom",
              offset: { y: 0.05 },
            },
          ],
        },
        {
          clips: [
            {
              alias: "voiceover",
              asset: { type: "audio", src: voiceoverUrl },
              start: 0,
              length: "auto",
            },
          ],
        },
        {
          clips: [
            {
              asset: { type: "video", src: FOOTAGE },
              start: 0,
              length: "end",
            },
          ],
        },
      ],
    },
    output: { format: "mp4", resolution: "hd" },
  };

  const renderRes = await fetch(`${SHOTSTACK_EDIT}/render`, {
    method: "POST",
    headers: { ...shotstackHeaders, "Content-Type": "application/json" },
    body: JSON.stringify(edit),
  });
  const renderBody = await renderRes.json();
  const renderId = renderBody.response?.id;
  if (!renderRes.ok || !renderId) {
    throw new Error(
      `Shotstack did not accept the render request: ${
        renderBody.message ?? JSON.stringify(renderBody)
      }`
    );
  }
  console.log(`✓ Render queued: ${renderId}`);

  // 4. Poll until the video is ready
  let render: { status?: string; url?: string; error?: string } = {};
  const renderDeadline = Date.now() + 600000;
  while (!["done", "failed"].includes(render.status ?? "")) {
    if (Date.now() > renderDeadline) {
      throw new Error("Timed out waiting for the render to finish.");
    }
    await sleep(3000);
    const statusRes = await fetch(`${SHOTSTACK_EDIT}/render/${renderId}`, {
      headers: shotstackHeaders,
    });
    if (!statusRes.ok) {
      throw new Error(
        `Checking the render status failed (${statusRes.status}): ${await statusRes.text()}`
      );
    }
    render = (await statusRes.json()).response ?? render;
  }
  if (render.status === "failed") {
    throw new Error(render.error || "The render failed.");
  }

  console.log(`✓ Video ready: ${render.url}`);
} catch (error) {
  console.error(
    "Error creating voice-over video:",
    error instanceof Error ? error.message : error
  );
  process.exit(1);
}
