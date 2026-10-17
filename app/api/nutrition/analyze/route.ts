import { z } from 'zod';

export const runtime = 'nodejs';

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 8;
const requestsByClient = new Map<string, { count: number; resetAt: number }>();

const allowedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

const analysisSchema = z.object({
  detected: z.boolean(),
  mealName: z.string().trim().min(1).max(100),
  calories: z.number().int().min(0).max(5000),
  proteinGrams: z.number().min(0).max(500),
  carbsGrams: z.number().min(0).max(1000),
  fatGrams: z.number().min(0).max(500),
  potentialNutrients: z.array(z.string().trim().min(1).max(80)).max(12),
  confidence: z.enum(['low', 'medium', 'high']),
  assumptions: z.string().trim().max(400),
});

const responseSchema = {
  type: 'object',
  properties: {
    detected: { type: 'boolean' },
    mealName: { type: 'string' },
    calories: { type: 'integer' },
    proteinGrams: { type: 'number' },
    carbsGrams: { type: 'number' },
    fatGrams: { type: 'number' },
    potentialNutrients: { type: 'array', items: { type: 'string' } },
    confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
    assumptions: { type: 'string' },
  },
  required: [
    'detected',
    'mealName',
    'calories',
    'proteinGrams',
    'carbsGrams',
    'fatGrams',
    'potentialNutrients',
    'confidence',
    'assumptions',
  ],
};

function jsonError(message: string, status: number, headers?: HeadersInit) {
  return Response.json({ error: message }, { status, headers });
}

function getClientKey(request: Request) {
  const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return request.headers.get('x-real-ip')?.trim() || forwardedFor || 'unknown';
}

function isRateLimited(clientKey: string) {
  const now = Date.now();

  for (const [key, value] of requestsByClient) {
    if (value.resetAt <= now) requestsByClient.delete(key);
  }

  const current = requestsByClient.get(clientKey);
  if (!current || current.resetAt <= now) {
    requestsByClient.set(clientKey, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  if (current.count >= MAX_REQUESTS_PER_WINDOW) return true;
  current.count += 1;
  return false;
}

function getOutputText(payload: unknown) {
  if (!payload || typeof payload !== 'object') return null;

  const result = payload as {
    output_text?: unknown;
    output?: unknown;
  };
  if (typeof result.output_text === 'string') return result.output_text;

  if (Array.isArray(result.output)) {
    const text = result.output
      .filter(
        (item): item is { type: string; text: string } =>
          !!item &&
          typeof item === 'object' &&
          'type' in item &&
          item.type === 'text' &&
          'text' in item &&
          typeof item.text === 'string',
      )
      .map((item) => item.text)
      .join('');
    return text || null;
  }

  return null;
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get('content-length'));
  if (Number.isFinite(contentLength) && contentLength > MAX_IMAGE_BYTES + 64 * 1024) {
    return jsonError('Choose an image smaller than 8 MB.', 413);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonError('Upload an image to analyze.', 400);
  }

  const image = formData.get('image');
  if (!(image instanceof File)) {
    return jsonError('Upload an image to analyze.', 400);
  }
  if (!allowedImageTypes.has(image.type)) {
    return jsonError('Use a JPEG, PNG, or WebP image.', 415);
  }
  if (image.size === 0 || image.size > MAX_IMAGE_BYTES) {
    return jsonError('Choose a non-empty image smaller than 8 MB.', 413);
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return jsonError('Meal photo analysis is not configured on this server.', 503);
  }

  const clientKey = getClientKey(request);
  if (isRateLimited(clientKey)) {
    return jsonError('Analysis limit reached. Please try again in about an hour.', 429, {
      'Retry-After': String(Math.ceil(RATE_LIMIT_WINDOW_MS / 1000)),
    });
  }

  const imageBase64 = Buffer.from(await image.arrayBuffer()).toString('base64');
  const prompt = [
    'Analyze the attached meal photo for a general food log.',
    'Estimate calories, protein, carbohydrates, and fat for the visible serving; these are rough estimates, not measurements.',
    'Name only foods that are reasonably visible. Do not claim exact micronutrient amounts; list only possible nutrient sources based on visible foods.',
    'Mention uncertainty about hidden ingredients and portion size in assumptions. Keep the meal name concise.',
    'If the image is not clearly a meal or the food cannot be identified, set detected to false and return zero nutrition values with an empty potentialNutrients array.',
  ].join(' ');

  let providerResponse: Response;
  try {
    providerResponse = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        model: 'gemini-3.8-flash',
        input: [
          { type: 'text', text: prompt },
          { type: 'image', data: imageBase64, mime_type: image.type },
        ],
        response_format: {
          type: 'text',
          mime_type: 'application/json',
          schema: responseSchema,
        },
      }),
      signal: AbortSignal.timeout(45_000),
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      return jsonError('Gemini analysis timed out. Try again with a smaller or clearer photo.', 504);
    }
    return jsonError('Could not connect to Google Gemini. Check your connection and try again.', 502);
  }

  if (!providerResponse.ok) {
    if (providerResponse.status === 429) {
      return jsonError('Google Gemini is temporarily rate limited. Please try again shortly.', 429);
    }
    if (providerResponse.status === 401 || providerResponse.status === 403) {
      return jsonError('Google Gemini rejected the server API key. Check the server configuration.', 502);
    }
    return jsonError('Google Gemini could not analyze this image. Try again with a clearer photo.', 502);
  }

  let providerPayload: unknown;
  try {
    providerPayload = await providerResponse.json();
  } catch {
    return jsonError('Google Gemini returned an unreadable response. Please try again.', 502);
  }

  const outputText = getOutputText(providerPayload);
  if (!outputText) {
    return jsonError('Google Gemini returned no analysis. Please try again.', 502);
  }

  let parsedOutput: unknown;
  try {
    parsedOutput = JSON.parse(outputText);
  } catch {
    return jsonError('Google Gemini returned an invalid analysis. Please try again.', 502);
  }

  const analysis = analysisSchema.safeParse(parsedOutput);
  if (!analysis.success) {
    return jsonError('Google Gemini returned incomplete nutrition data. Please try again.', 502);
  }
  if (!analysis.data.detected) {
    return jsonError('A meal could not be identified clearly. Try a brighter photo focused on the food.', 422);
  }

  return Response.json(analysis.data, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
