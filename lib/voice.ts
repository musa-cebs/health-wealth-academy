/**
 * Voice for the Pocket Coach (Azure AI Speech REST APIs).
 * - speech to text: the "short audio" API (OGG/Opus, up to 60 seconds, one language per request)
 * - text to speech: neural voice, returned as OGG/Opus so WhatsApp plays it as a voice note
 * Audio is never stored: it is transcribed or synthesised in memory and dropped.
 */
const key = () => process.env.SPEECH_KEY;
const region = () => process.env.SPEECH_REGION;

export const voiceConfigured = () => Boolean(key() && region());
/** Languages tried in order for incoming voice notes (the first that returns text wins). */
export const sttLocales = () => (process.env.SPEECH_LOCALES || "en-ZA").split(",").map((s) => s.trim()).filter(Boolean);
export const dailyVoiceLimit = () => Math.max(1, Number(process.env.VOICE_DAILY_LIMIT) || 20);

export type Transcript = { ok: true; text: string; locale: string } | { ok: false; reason: "empty" | "too_long" | "error" };

export async function transcribe(audio: Buffer): Promise<Transcript> {
  if (!voiceConfigured()) return { ok: false, reason: "error" };
  let sawEmpty = false;
  for (const locale of sttLocales()) {
    try {
      const r = await fetch(
        `https://${region()}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=${encodeURIComponent(locale)}&format=simple`,
        { method: "POST", headers: { "Ocp-Apim-Subscription-Key": key()!, "Content-Type": "audio/ogg; codecs=opus", Accept: "application/json" }, body: new Uint8Array(audio) },
      );
      if (r.status === 400) { console.error("stt rejected the audio", r.status); return { ok: false, reason: "too_long" }; }
      if (!r.ok) { console.error("stt failed", r.status); return { ok: false, reason: "error" }; }
      const j = (await r.json()) as { RecognitionStatus?: string; DisplayText?: string };
      const text = (j.DisplayText ?? "").trim();
      if (j.RecognitionStatus === "Success" && text) return { ok: true, text, locale };
      sawEmpty = true;
    } catch (e) {
      console.error("stt error", e instanceof Error ? e.message : e);
      return { ok: false, reason: "error" };
    }
  }
  return { ok: false, reason: sawEmpty ? "empty" : "error" };
}

type Voice = { ShortName: string; Locale: string; Gender?: string };
let voices: Voice[] | null = null;
const picked = new Map<string, string>();

async function listVoices(): Promise<Voice[]> {
  if (voices) return voices;
  const r = await fetch(`https://${region()}.tts.speech.microsoft.com/cognitiveservices/voices/list`, { headers: { "Ocp-Apim-Subscription-Key": key()! } });
  if (!r.ok) throw new Error(`voice list ${r.status}`);
  voices = (await r.json()) as Voice[];
  return voices;
}

/** A neural voice for the language, looked up from Azure rather than assumed. TTS_VOICE overrides. */
export async function pickVoice(locale: string): Promise<{ name: string; locale: string }> {
  if (process.env.TTS_VOICE) return { name: process.env.TTS_VOICE, locale: process.env.TTS_VOICE.split("-").slice(0, 2).join("-") };
  const cached = picked.get(locale);
  if (cached) return { name: cached, locale };
  let all: Voice[] = [];
  try { all = await listVoices(); } catch (e) { console.error("tts voice lookup failed", e instanceof Error ? e.message : e); }
  const best = (loc: string) => {
    const pool = all.filter((v) => v.Locale === loc && /neural/i.test(v.ShortName));
    return pool.find((v) => v.Gender === "Female") ?? pool[0];
  };
  const v = best(locale) ?? best("en-ZA") ?? best("en-GB") ?? best("en-US");
  if (v) { picked.set(locale, v.ShortName); return { name: v.ShortName, locale: v.Locale }; }
  return { name: "en-US-JennyNeural", locale: "en-US" };
}

/** Turns a WhatsApp-formatted reply into something that sounds natural when read aloud. */
export function cleanForSpeech(text: string, maxChars = 900): string {
  let t = text
    .replace(/https?:\/\/\S+/g, "")
    .replace(/^\s*-{3,}\s*$/gm, " ")
    .replace(/[*_~`]/g, "")
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/^\s*[-•]\s+/gm, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\bR\s?(\d+(?: \d{3})*)[.,](\d{2})\b/g, (_, r, c) => `${r.replace(/ /g, "")} rand${c === "00" ? "" : " " + c + " cents"}`)
    .replace(/\bR\s?(\d+(?: \d{3})*)\b/g, (_, r) => `${r.replace(/ /g, "")} rand`)
    .replace(/\(([^)]*)\)/g, ", $1,")
    .replace(/\s*\n+\s*/g, ". ")
    .replace(/\.\s*\./g, ".")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (t.length > maxChars) {
    const cut = t.slice(0, maxChars);
    const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("? "), cut.lastIndexOf("! "));
    t = (end > 200 ? cut.slice(0, end + 1) : cut).trim();
  }
  return t;
}

const xml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

/** OGG/Opus audio of the text, or null if speech could not be produced (the caller already sent the text). */
export async function synthesize(text: string, locale = "en-ZA"): Promise<Buffer | null> {
  if (!voiceConfigured()) return null;
  const clean = cleanForSpeech(text);
  if (!clean) return null;
  try {
    const v = await pickVoice(locale);
    const ssml = `<speak version="1.0" xml:lang="${v.locale}"><voice name="${v.name}">${xml(clean)}</voice></speak>`;
    const r = await fetch(`https://${region()}.tts.speech.microsoft.com/cognitiveservices/v1`, {
      method: "POST",
      headers: { "Ocp-Apim-Subscription-Key": key()!, "Content-Type": "application/ssml+xml", "X-Microsoft-OutputFormat": "ogg-24khz-16bit-mono-opus", "User-Agent": "pocket-coach" },
      body: ssml,
    });
    if (!r.ok) { console.error("tts failed", r.status); return null; }
    return Buffer.from(await r.arrayBuffer());
  } catch (e) {
    console.error("tts error", e instanceof Error ? e.message : e);
    return null;
  }
}
