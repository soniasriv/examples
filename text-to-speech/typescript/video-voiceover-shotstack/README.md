# ElevenLabs Video Voice-over Example (Shotstack)

Put an ElevenLabs voice inside a finished, captioned video with [Shotstack](https://shotstack.io),
a cloud video editing API. There are two ways, depending on whose ElevenLabs account makes the voice.

## The one-line way (library voices)

ElevenLabs Text to Speech and Music are built into Shotstack's Edit API as native audio assets.
You describe the voice inside the video JSON and Shotstack generates it with ElevenLabs at render
time. No SDK calls, no audio files, no uploads:

```json
{
  "alias": "voiceover",
  "asset": {
    "type": "audio",
    "prompt": "Welcome to 12 Seaview Road. Three bedrooms of morning light, and the beach a five-minute walk away.",
    "model": "elevenlabs-tts",
    "options": { "voice": "Charlotte" }
  },
  "start": 0,
  "length": "auto"
}
```

Background music works the same way with `"model": "elevenlabs-music"` and a text prompt.
Use this path when a voice from the ElevenLabs library is enough. See the
[Shotstack docs](https://shotstack.io/docs/guide/) for the audio asset reference.

## This example: bring your own ElevenLabs account (cloned and custom voices)

The script in `example/` is for developers who already use ElevenLabs directly and want **their
own voices** in video: a voice cloned with Instant Voice Cloning, a voice from your voice library,
your own model settings, on your own character quota. It generates the voice-over with the
ElevenLabs SDK, hands the audio to Shotstack, and renders a video with captions transcribed
automatically from the voice.

### Setup

1. Move into the example directory (all commands below run from `example/`):

   ```bash
   cd example
   ```

2. Copy the environment file and add your API keys:

   ```bash
   cp .env.example .env
   ```

   Then edit `.env` and paste your [ElevenLabs API key](https://elevenlabs.io/app/settings/api-keys)
   and a [Shotstack production API key](https://dashboard.shotstack.io/register). To narrate in a
   cloned voice, set `ELEVENLABS_VOICE_SAMPLE` to the path of a one-to-three-minute voice recording
   (cloning needs a paid ElevenLabs plan); otherwise the example uses a default library voice.

3. Install dependencies:

   ```bash
   pnpm install
   ```

### Run

```bash
pnpm run start "Welcome to 12 Seaview Road. Three bedrooms of morning light, and the beach a five-minute walk away."
```

The script prints the URL of the finished MP4. Renders use the production environment and consume
Shotstack credits; for free watermarked test renders, switch `v1` to `stage` in `index.ts` and use
a sandbox key. The full run takes two to four minutes. Note: caption transcription consumes
Shotstack generation credits. Remove the `rich-caption` track in `index.ts` to render without
captions.

## Which way should I use?

| | One-line audio asset | This example (own account) |
|---|---|---|
| Voices | ElevenLabs library | Your cloned and custom voices |
| ElevenLabs account | Not needed | Yours, with your quota |
| Code | None, JSON only | Small TypeScript script |
| Best for | Quick narration in any render | Your brand voice, at scale |
