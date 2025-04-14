# Airtable Image Proxy Cloudflare Worker

A while ago Airtable changed their API such that image URLs are only valid for a limited time. This Cloudflare Worker is a basic proxy to extend the URL lifetime. It caches the image for 1 day, and once the cache expires, will re-fetch the image by getting the most recent URL from the underlying Airtable record.

## How It Works

1. **Request Format:**  
   The URL format is:

    ```
    https://your-worker-domain.workers.dev/{baseId}/{tableId}/{recordId}[?index={imageIndex}]
    ```

    - `{baseId}`, `{tableId}`, `{recordId}`: Required path parameters.
    - `?index={imageIndex}`: Optional query parameter (zero-based) to select a specific image if the Airtable field contains multiple attachments. If omitted, defaults to the first image (`index=0`).
    - **NOTE:** This assumes that your images are located in a field named `images`. If your field is named differently, you can change the `IMAGE_FIELD` constant in the `src/worker.ts` file.

2. **Airtable Record Fetch:**  
   The Worker calls the Airtable API to fetch the record data.
3. **Image URL Extraction:**  
   It extracts the image URL from the "Image" field.
4. **Image Fetch & Response:**  
   The Worker fetches the image, forwards proper HTTP headers, caches the response, and serves the image with a `200` status code.

## Deployment

1. Install Cloudflare Wrangler if you haven't already:

    ```bash
    npm install -g wrangler
    ```

2. Set your Airtable API key using Wrangler secrets:

    ```bash
    wrangler secret put AIRTABLE_ACCESS_TOKEN
    ```

    **Important:** This command securely stores your API token with Cloudflare. You can also add/manage secrets via the Cloudflare Dashboard (Worker > Settings > Variables > Secrets).
    **Do not** add your `AIRTABLE_ACCESS_TOKEN` to the `wrangler.toml` file or commit it to Git. Use a `.dev.vars` file (added to `.gitignore`) for local development if needed, but secrets are the standard for deployed workers.

3. Deploy the Worker:
    ```bash
    wrangler deploy
    ```

## Usage

Access an image using:

```
https://your-worker-domain.workers.dev/{baseId}/{tableId}/{recordId}[?index={imageIndex}]
```

Example (first image):

```
https://your-worker-domain.workers.dev/app123ABC/myTable/recXYZ789
```

Example (third image, index 2):

```
https://your-worker-domain.workers.dev/app123ABC/myTable/recXYZ789?index=2
```

## Summary

-   **Dynamic URLs:** Supports different Airtable bases/tables by extracting the baseId, tableId, and recordId from the URL.
-   **Caching:** Cloudflare caches the full image response, ensuring that even if the underlying Airtable URL expires, the cached image remains served.
-   **No External Dependencies:** The project is self-contained, using only the native Cloudflare Workers API and TypeScript.
-   **Easy Deployment:** Configured for auto-deployment using Wrangler and GitHub Actions if desired.
