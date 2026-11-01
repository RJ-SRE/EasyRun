import test from "node:test";
import assert from "node:assert/strict";
import { privateBucketInfo, discoverKodo } from "../kodo-config.mjs";
import { KodoStore } from "../storage.mjs";
const options = {
  bucket: "fixture",
  accessKey: "fixture-ak",
  secretKey: "fixture-sk",
};
test("Kodo startup refuses public, missing or inaccessible bucket permissions", async () => {
  for (const value of [{ private: 0 }, {}, { private: "1" }]) {
    await assert.rejects(
      privateBucketInfo({
        ...options,
        fetcher: async () => Response.json(value),
      }),
      /PRIVATE_BUCKET_REQUIRED/,
    );
  }
  await assert.rejects(
    privateBucketInfo({
      ...options,
      fetcher: async () => new Response("", { status: 401 }),
    }),
    /BUCKET_CHECK_FAILED/,
  );
  const store = new KodoStore({
    ...options,
    uploadOrigin: "https://upload.invalid",
    privateReadOrigin: "https://read.invalid",
    fetcher: async () => Response.json({ private: 0 }),
  });
  await assert.rejects(store.init(), /PRIVATE_BUCKET_REQUIRED/);
});
test("Kodo discovers matching region HTTPS origin and never uses a CDN test domain", async () => {
  const requests = [];
  const fetcher = async (url, init) => {
    requests.push({ url, init });
    return String(url).includes("bucketInfo")
      ? Response.json({ private: 1, region: "z2" })
      : Response.json({
          hosts: [
            {
              region: "z2",
              up: { domains: ["up-z2.qiniup.com"] },
              rs: { domains: ["rs-z2.qbox.me"] },
              io_src: { domains: ["fixture.kodo-cn-south-1.qiniucs.com"] },
            },
          ],
        });
  };
  const found = await discoverKodo(options, fetcher);
  assert.equal(
    found.privateReadOrigin,
    "https://fixture.kodo-cn-south-1.qiniucs.com",
  );
  assert.equal(found.region, "z2");
  assert.match(requests[0].init.headers.Authorization, /^Qiniu fixture-ak:/);
  assert.equal(requests[0].init.redirect, "error");
  assert.equal(requests[1].url.searchParams.get("bucket"), "fixture");
});
test("Kodo rejects foreign endpoint discovery and unsafe test prefixes", async () => {
  const fetcher = async (url) =>
    String(url).includes("bucketInfo")
      ? Response.json({ private: 1, region: "z2" })
      : Response.json({
          hosts: [
            { region: "z2", up: { domains: ["qiniup.com.attacker.invalid"] } },
          ],
        });
  await assert.rejects(discoverKodo(options, fetcher), /ENDPOINT_INVALID/);
  assert.throws(
    () =>
      new KodoStore({
        ...options,
        uploadOrigin: "https://up.invalid",
        privateReadOrigin: "https://read.invalid",
        keyPrefix: "rupture/learning-tests/../users",
      }),
    /KEY_PREFIX/,
  );
});
