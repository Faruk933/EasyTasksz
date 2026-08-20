const fs = require("node:fs");

const API_KEY = process.env.IMAGINEPRO_API_KEY;
const POST_TEXT = process.argv.slice(2).join(" ");

if (!API_KEY) throw new Error("Missing IMAGINEPRO_API_KEY");
if (!POST_TEXT) throw new Error("Missing post text");

const LOGO_URL =
  "https://cdn.phototourl.com/free/2026-08-20-c1e0ec26-54bf-497e-b36b-966a8cbe73d1.png";

const SUBMIT_URL =
  "https://api.imaginepro.ai/api/v1/universal/imagine";

const FETCH_URL =
  "https://api.imaginepro.ai/api/v1/message/fetch/";

const prompt = `
Create a completely new professional EasyTasksz advertising image.

Use the supplied EasyTasksz logo as a BRAND IDENTITY REFERENCE.
Do not simply place the logo on the generated image.

Maintain a consistent EasyTasksz visual identity:
- rich purple/violet as the dominant brand colour
- vibrant lime-green accents
- warm yellow/gold highlights
- dark premium backgrounds where appropriate
- smooth purple gradients
- subtle professional glow
- modern digital-work and fintech aesthetic
- clean, trustworthy and energetic composition

The colours should naturally appear throughout the scene,
lighting, clothing accents, objects, UI elements and background.

Create a visual that communicates this specific post:

${POST_TEXT}

Make the result look like part of one professionally designed
EasyTasksz advertising campaign.

Do not create another company logo.
Do not use cryptocurrency imagery.
Do not use excessive neon.
Do not make the image look like a generic stock photo.
Do not merely paste the reference logo onto the image.
`;

async function submit() {
  const response = await fetch(SUBMIT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${API_KEY}`,
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

  const body = await response.json();

  console.log("ImaginePro HTTP:", response.status);

  if (!response.ok || !body.success) {
    throw new Error(JSON.stringify(body));
  }

  return body.messageId;
}

async function waitForImage(messageId) {
  for (let attempt = 1; attempt <= 60; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 5000));

    const response = await fetch(
      `${FETCH_URL}${messageId}`,
      {
        headers: {
          Authorization: `Bearer ${API_KEY}`
        }
      }
    );

    const body = await response.json();

    console.log(
      `Attempt ${attempt}: ${body.status} (${body.progress ?? 0}%)`
    );

    if (
      body.status === "FAIL" ||
      body.status === "FAILED" ||
      body.status === "ERROR"
    ) {
      throw new Error(
        `Image generation failed: ${JSON.stringify(body)}`
      );
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
        throw new Error(
          `Generation completed without image URL: ${JSON.stringify(body)}`
        );
      }

      return imageUrl;
    }
  }

  throw new Error("Image generation timed out.");
}

(async () => {
  console.log("Generating EasyTasksz branded image...");

  const messageId = await submit();

  console.log("Message ID:", messageId);

  const imageUrl = await waitForImage(messageId);

  console.log("\nIMAGE_URL=" + imageUrl);

  fs.writeFileSync(
    "automation/generated-image-url.txt",
    imageUrl + "\n"
  );
})().catch(error => {
  console.error(error);
  process.exit(1);
});
