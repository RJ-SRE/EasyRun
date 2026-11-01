import { createHmac } from "node:crypto";
import { requireThat } from "./rules.mjs";

export function kodoOptions(env = process.env) {
  return {
    bucket: env.KODO_BUCKET,
    accessKey: env.KODO_ACCESS_KEY,
    secretKey: env.KODO_SECRET_KEY,
    uploadOrigin: env.KODO_UPLOAD_ORIGIN,
    privateReadOrigin: env.KODO_PRIVATE_READ_ORIGIN,
    managementOrigin: env.KODO_MANAGEMENT_ORIGIN,
    controlOrigin: env.KODO_CONTROL_ORIGIN,
  };
}

export async function privateBucketInfo({
  bucket,
  accessKey,
  secretKey,
  controlOrigin = "https://uc.qiniuapi.com",
  fetcher = fetch,
}) {
  const url = new URL("/v2/bucketInfo", controlOrigin);
  url.searchParams.set("bucket", bucket);
  const contentType = "application/x-www-form-urlencoded";
  const canonical = `POST ${url.pathname}${url.search}\nHost: ${url.host}\nContent-Type: ${contentType}\n\n`;
  const signature = createHmac("sha1", secretKey)
    .update(canonical)
    .digest("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_");
  const response = await fetcher(url, {
    method: "POST",
    redirect: "error",
    signal: AbortSignal.timeout(10000),
    headers: {
      "Content-Type": contentType,
      Authorization: `Qiniu ${accessKey}:${signature}`,
    },
  });
  requireThat(response.ok, "KODO_BUCKET_CHECK_FAILED", 503);
  const info = await response.json();
  requireThat(info.private === 1, "KODO_PRIVATE_BUCKET_REQUIRED", 503);
  return { private: true, region: info.region };
}

// Resolve source/upload endpoints directly from Qiniu, not the expiring CDN test
// domain. Only HTTPS origins operated by Qiniu can receive storage credentials.
export async function discoverKodo(options, fetcher = fetch) {
  requireThat(
    /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(options.bucket || ""),
    "KODO_BUCKET_NAME",
    503,
  );
  const info = await privateBucketInfo({
    ...options,
    controlOrigin: "https://uc.qiniuapi.com",
    fetcher,
  });
  const url = new URL("https://uc.qiniuapi.com/v4/query");
  url.searchParams.set("ak", options.accessKey);
  url.searchParams.set("bucket", options.bucket);
  const response = await fetcher(url, {
    redirect: "error",
    signal: AbortSignal.timeout(10000),
  });
  requireThat(response.ok, "KODO_REGION_DISCOVERY_FAILED", 503);
  const data = await response.json();
  const host = data.hosts?.find((h) => h.region === info.region);
  requireThat(host, "KODO_REGION_MISMATCH", 503);
  const origin = (domain) => {
    requireThat(
      typeof domain === "string" &&
        /^[a-z0-9.-]+\.(qiniup\.com|qiniuapi\.com|qiniucs\.com|qbox\.me)$/.test(
          domain,
        ),
      "KODO_ENDPOINT_INVALID",
      503,
    );
    return `https://${domain}`;
  };
  return {
    region: info.region,
    private: true,
    uploadOrigin: origin(host.up?.domains?.[0]),
    privateReadOrigin: origin(host.io_src?.domains?.[0]),
    managementOrigin: origin(host.rs?.domains?.[0]),
    controlOrigin: "https://uc.qiniuapi.com",
  };
}
