Before writing any code, invoke the `/text-to-speech` skill to learn the correct ElevenLabs SDK patterns.

## Two paths

Shotstack embeds ElevenLabs TTS and Music as native audio assets: an audio asset with a `prompt`, `"model": "elevenlabs-tts"` (or `"elevenlabs-music"`), and `options` generates the audio with ElevenLabs at render time. Use that path when a library voice is enough; it needs no code. Build `index.ts` for the other path: developers with their own ElevenLabs account who want their own cloned or custom voices in the video.

## `index.ts`

Create a minimal script that turns a text script into a finished, captioned voice-over video using ElevenLabs Text-to-Speech and the Shotstack Edit API.

- Load env vars from `.env` (`ELEVENLABS_API_KEY`, `SHOTSTACK_API_KEY`, optional `ELEVENLABS_VOICE_SAMPLE` and `ELEVENLABS_VOICE_ID`).
- Read text from CLI args; fall back to a short default script.
- If `ELEVENLABS_VOICE_SAMPLE` is set, clone that recording with Instant Voice Cloning and use the returned voice ID; otherwise use `ELEVENLABS_VOICE_ID` or fall back to `"JBFqnCBsd6RMkjVDRZzb"`. Generate speech with `modelId: "eleven_multilingual_v2"`.
- Upload the audio to the Shotstack Ingest API (`POST https://api.shotstack.io/ingest/v1/upload` for a signed URL, `PUT` the bytes, then poll `GET /ingest/v1/sources/{id}` until `attributes.source` is set).
- Submit a render to `POST https://api.shotstack.io/edit/v1/render` with three tracks, top first: a `rich-caption` asset with `src: "alias://voiceover"` (captions transcribed from the voice), the `audio` asset with `alias: "voiceover"` and `length: "auto"`, and a background `video` asset with `length: "end"`.
- Poll `GET /edit/v1/render/{id}` every 3 seconds until `done` or `failed`.
- Print the finished video URL.
- Handle errors with a readable message; never print API keys.
