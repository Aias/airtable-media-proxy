import type { ExecutionContext } from '@cloudflare/workers-types';

export interface Env {
	AIRTABLE_ACCESS_TOKEN: string;
}

const MAX_AGE = 60 * 60 * 24; // Cache for 1 day.
const IMAGE_FIELD = 'images';

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);
		const segments = url.pathname.split('/').filter(Boolean);

		// Expecting exactly three segments: baseId, tableId, recordId
		if (segments.length !== 3) {
			return new Response('Invalid request format. Use /{baseId}/{tableId}/{recordId}', { status: 400 });
		}

		const [baseId, tableId, recordId] = segments;
		const cache = await caches.open('default');
		let response = await cache.match(request);
		if (response) return response;

		// Fetch the Airtable record for the given base, table, and record ID.
		const airtableApiUrl = `https://api.airtable.com/v0/${baseId}/${tableId}/${recordId}`;
		const airtableRes = await fetch(airtableApiUrl, {
			headers: {
				Authorization: `Bearer ${env.AIRTABLE_ACCESS_TOKEN}`
			}
		});

		if (!airtableRes.ok) {
			const errorText = await airtableRes.text();
			console.error(
				`Airtable API error for ${recordId}: ${airtableRes.status} ${airtableRes.statusText}. Body: ${errorText}`
			);
			return new Response('Airtable record not found', { status: 404 });
		}

		const data = (await airtableRes.json()) as {
			fields?: Record<string, { url: string }[]>;
		};

		// Get the image field (change "Image" if necessary)
		const imageField = data.fields?.[IMAGE_FIELD];
		if (!imageField || imageField.length === 0) {
			return new Response('Image field not found or empty', { status: 404 });
		}

		// Parse the optional 'index' query parameter
		const indexStr = url.searchParams.get('index');
		let imageIndex = 0; // Default to the first image
		if (indexStr) {
			imageIndex = parseInt(indexStr, 10);
			// Validate index
			if (isNaN(imageIndex) || imageIndex < 0 || imageIndex >= imageField.length) {
				return new Response(`Invalid image index: ${indexStr}. Max index is ${imageField.length - 1}`, {
					status: 400
				});
			}
		}

		// Get the specific image URL based on the index
		const imageUrl = imageField[imageIndex]?.url;
		if (!imageUrl) {
			// This case should technically be caught by the index validation, but check just in case
			return new Response('Image URL not found for the specified index', { status: 404 });
		}

		// Fetch the actual image from Airtable's URL.
		const imageRes = await fetch(imageUrl);
		if (!imageRes.ok) {
			return new Response('Failed to fetch image', { status: 502 });
		}

		// Set relevant headers: override Cache-Control; forward Content-Type, ETag, Last-Modified, and Content-Length.
		const headers = new Headers({
			'Content-Type': imageRes.headers.get('Content-Type') || 'application/octet-stream',
			'Cache-Control': `public, max-age=${MAX_AGE}`
		});

		const lastModified = imageRes.headers.get('Last-Modified');
		if (lastModified) headers.set('Last-Modified', lastModified);

		const contentLength = imageRes.headers.get('Content-Length');
		if (contentLength) headers.set('Content-Length', contentLength);

		response = new Response(imageRes.body, { status: 200, headers });
		ctx.waitUntil(cache.put(request, response.clone()));

		return response;
	}
};
