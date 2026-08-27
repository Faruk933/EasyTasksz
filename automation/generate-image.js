const fs = require("node:fs");

const POST_TEXT = process.argv.slice(2).join(" ");

const API_KEY_NAMES = [
  "IMAGINEPRO_API_KEY",
  "IMAGINEPRO_API_KEY_2",
  "IMAGINEPRO_API_KEY_3",
  "IMAGINEPRO_API_KEY_4",
  "IMAGINEPRO_API_KEY_5",
  "IMAGINEPRO_API_KEY_6",
  "IMAGINEPRO_API_KEY_7",
  "IMAGINEPRO_API_KEY_8",
  "IMAGINEPRO_API_KEY_9",
  "IMAGINEPRO_API_KEY_10"
];

const API_KEYS = API_KEY_NAMES
  .map(name => process.env[name])
  .filter(Boolean);

if (!API_KEYS.length) throw new Error("No ImaginePro API keys are configured");
if (!POST_TEXT) throw new Error("Missing post text");

const LOGO_URL =
  "https://cdn.phototourl.com/free/2026-08-20-c1e0ec26-54bf-497e-b36b-966a8cbe73d1.png";

const SUBMIT_URL =
  "https://api.imaginepro.ai/api/v1/universal/imagine";

const FETCH_URL =
  "https://api.imaginepro.ai/api/v1/message/fetch/";

const prompt = `
Create a completely new professional EasyTasksz advertising image.

Use the supplied EasyTasksz logo image as the BRAND IDENTITY AND VISUAL REFERENCE.
Do not simply paste, overlay, trace, or reproduce the logo in the final artwork.
Use the actual logo reference to understand the brand's visual character and derive
its natural colour palette, tones, contrast, and overall visual feel. Do not assume
or force any particular colours; let the supplied logo determine the palette.

Create a polished, modern, trustworthy social-media graphic that communicates the
idea AND useful information from this specific post:

${POST_TEXT}

IMPORTANT: This image must contain readable text information, not just a graphic
illustration. Treat the supplied post as the source of truth for the text shown in
the image.

TEXT CONTENT REQUIREMENTS:
- Extract the most important information from the supplied post and present it as
  concise, useful on-image text.
- Create one clear, attention-grabbing headline based on the post.
- Add 2-4 short supporting points or a concise supporting sentence containing the
  key instructions, benefit, action, requirement, or other important information
  from the post.
- Preserve important facts, numbers, names, requirements, and meaning from the
  supplied post. Do not invent facts, offers, prices, rewards, dates, links, or
  instructions that are not present in the post.
- Keep the wording concise enough to fit comfortably and remain highly readable.
- Use strong visual hierarchy: headline first, supporting information second.
- Use clean, professional typography with correct spelling and natural line breaks.
- Make all intended text large enough to read clearly on a mobile social-media feed.
- If the post contains a URL, do not invent or alter it. Include it only if it can
  be rendered accurately and legibly; otherwise prioritize the main information.
- Do not fill the image with unnecessary text. Quality and readability are more
  important than including every sentence of the post.

VISUAL + TEXT BALANCE:
- Combine the informative typography with a relevant, attractive visual scene.
- The visual should reinforce the meaning of the post rather than compete with the
  information.
- Use deliberate space for the headline and supporting text; do not place text over
  busy faces, hands, important objects, or high-detail backgrounds.
- Text should look like intentional professional campaign design, not random labels
  pasted onto an image.
- The final result should feel like a real EasyTasksz social-media advertisement or
  educational post: visually engaging AND informative at a glance.

BRAND RULES:
- The only brand reference is the supplied EasyTasksz logo.
- Do not invent another company's logo, brand, watermark, or product identity.
- Keep the EasyTasksz visual character consistent with the supplied logo.

Visual direction:
- premium digital-work and fintech-inspired aesthetic
- clean, professional, energetic composition
- natural brand colours derived from the supplied logo
- coherent lighting and colour harmony
- subtle polished depth and professional detail
- visually distinctive enough to feel like a real EasyTasksz campaign

Avoid generic stock-photo appearance, excessive neon, cryptocurrency imagery,
cluttered compositions, robotic-looking subjects, fake words, misspelled text,
and meaningless decorative typography.
`;

async function submit(apiKey) {
  const response = await fetch(SUBMIT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      contents: [
        {
          type: "text",
          text: prompt
        },
        {
          type: "image",
          url: LOGO_URL
        }
      ]
    })
  });

  let body;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  console.log("ImaginePro HTTP:", response.status);

  if (!response.ok || !body?.success || !body?.messageId) {
    throw new Error(`ImaginePro submission failed (HTTP ${response.status})`);
  }

  return body.messageId;
}

async function waitForImage(apiKey, messageId) {
  for (let attempt = 1; attempt <= 60; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 5000));

    const response = await fetch(
      `${FETCH_URL}${messageId}`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`
        }
      }
    );

    let body;
    try {
      body = await response.json();
    } catch {
      body = null;
    }

    if (!response.ok || !body) {
      throw new Error(`ImaginePro status request failed (HTTP ${response.status})`);
    }

    console.log(
      `Attempt ${attempt}: ${body.status} (${body.progress ?? 0}%)`
    );

    if (
      body.status === "FAIL" ||
      body.status === "FAILED" ||
      body.status === "ERROR"
    ) {
      throw new Error(`Image generation failed with status ${body.status}`);
    }

    if (
      body.status === "DONE" ||
      Number(body.progress) >= 100
    ) {
      const imageUrl =
        Array.isArray(body.images) && body.images.length
          ? body.images[0]
          : body.uri;

      if (!imageUrl) {
        throw new Error("Generation completed without an image URL");
      }

      return imageUrl;
    }
  }

  throw new Error("Image generation timed out");
}

(async () => {
  console.log(`Generating EasyTasksz branded image using up to ${API_KEYS.length} ImaginePro keys...`);

  let lastError;

  for (let index = 0; index < API_KEYS.length; index++) {
    const apiKey = API_KEYS[index];

    try {
      console.log(`Trying ImaginePro key #${index + 1}...`);

      const messageId = await submit(apiKey);
      console.log("Message ID:", messageId);

      const imageUrl = await waitForImage(apiKey, messageId);

      fs.writeFileSync(
        "automation/generated-image-url.txt",
        imageUrl + "\n"
      );

      console.log("\nIMAGE_URL=" + imageUrl);
      console.log(`ImaginePro key #${index + 1} succeeded.`);
      return;
    } catch (error) {
      lastError = error;
      console.error(`ImaginePro key #${index + 1} failed: ${error.message}`);

      if (index < API_KEYS.length - 1) {
        console.log("Trying the next ImaginePro key...");
      }
    }
  }

  throw new Error(
    `All ${API_KEYS.length} available ImaginePro API keys failed. Last error: ${lastError?.message || "unknown error"}`
  );
})().catch(error => {
  console.error(error);
  process.exit(1);
});
