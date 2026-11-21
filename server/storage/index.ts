import { S3Client } from "bun";
import { createHash, createHmac } from "node:crypto";
import { mkdir, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";

interface Store {
  put(key: string, data: Uint8Array, type: string): Promise<void>;
  get(key: string): Promise<Uint8Array<ArrayBuffer> | null>;
  delete(key: string): Promise<void>;
  /** A direct link and until when (unix seconds) it may be handed out; null when the object must be served through get(). */
  link(key: string): { url: string; until: number } | null;
}

const checked = (key: string) => {
  if (!/^[a-z0-9][a-z0-9/_-]*\.[a-z0-9]+$/.test(key) || key.includes("//")) throw new Error(`bad storage key: ${key}`);
  return key;
};

const LINK_LIFE = 7 * 86400;
// links are signed as of the start of a 3-day period, so each stays the same (and browser-cached) for up to 3 days
// and still has 4 or more days to run when handed out
const LINK_STEP = 3 * 86400;

type SignOptions = { endpoint: string; bucket: string; region: string; id: string; secret: string; key: string; at: number };

// SigV4 written out (not the S3 client's presign) so the link depends only on the key and the period
function presign(o: SignOptions) {
  const host = new URL(o.endpoint).host;
  const enc = (s: string) => encodeURIComponent(s).replace(/[!'()*]/g, c => "%" + c.charCodeAt(0).toString(16).toUpperCase());
  const path = `/${enc(o.bucket)}/${o.key.split("/").map(enc).join("/")}`;
  const stamp = new Date(o.at * 1000).toISOString().replace(/[-:]|\.\d{3}/g, "");
  const day = stamp.slice(0, 8);
  const scope = `${day}/${o.region}/s3/aws4_request`;
  const params: Record<string, string> = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${o.id}/${scope}`,
    "X-Amz-Date": stamp,
    "X-Amz-Expires": String(LINK_LIFE),
    "X-Amz-SignedHeaders": "host",
    // objects never change under a key; the link itself is what expires
    "response-cache-control": "private, max-age=31536000, immutable",
  };
  const query = Object.keys(params).sort().map(k => `${enc(k)}=${enc(params[k]!)}`).join("&");
  const request = ["GET", path, query, `host:${host}\n`, "host", "UNSIGNED-PAYLOAD"].join("\n");
  const requestHash = createHash("sha256").update(request).digest("hex");
  const toSign = ["AWS4-HMAC-SHA256", stamp, scope, requestHash].join("\n");
  let k: Buffer = createHmac("sha256", "AWS4" + o.secret).update(day).digest();
  for (const part of [o.region, "s3", "aws4_request"]) k = createHmac("sha256", k).update(part).digest();
  const signature = createHmac("sha256", k).update(toSign).digest("hex");
  return `${o.endpoint.replace(/\/+$/, "")}${path}?${query}&X-Amz-Signature=${signature}`;
}

function s3Store(env: NodeJS.ProcessEnv): Store {
  const endpoint = env.S3_ENDPOINT || `https://s3.${env.S3_REGION || "us-east-1"}.amazonaws.com`;
  const o = {
    endpoint,
    bucket: env.S3_BUCKET!,
    region: env.S3_REGION || "auto",
    id: env.S3_ACCESS_KEY_ID || "",
    secret: env.S3_SECRET_ACCESS_KEY || "",
  };
  if (!o.id || !o.secret) throw new Error("S3_BUCKET is set but S3_ACCESS_KEY_ID or S3_SECRET_ACCESS_KEY is missing");
  const client = new S3Client({ endpoint, bucket: o.bucket, region: o.region, accessKeyId: o.id, secretAccessKey: o.secret });
  return {
    async put(key, data, type) {
      await client.write(checked(key), data, { type });
    },
    async get(key) {
      const f = client.file(checked(key));
      try {
        return new Uint8Array(await f.arrayBuffer());
      } catch (e) {
        if ((e as { code?: string }).code === "NoSuchKey") return null;
        throw e;
      }
    },
    async delete(key) {
      await client.delete(checked(key));
    },
    link(key) {
      const at = Math.floor(Date.now() / 1000 / LINK_STEP) * LINK_STEP;
      return { url: presign({ ...o, key: checked(key), at }), until: at + LINK_STEP };
    },
  };
}

function localStore(env: NodeJS.ProcessEnv): Store {
  const root = join(env.DATA_DIR || "data", "media");
  const at = (key: string) => join(root, checked(key));
  return {
    async put(key, data) {
      await mkdir(dirname(at(key)), { recursive: true });
      await Bun.write(at(key), data);
    },
    async get(key) {
      const f = Bun.file(at(key));
      return (await f.exists()) ? new Uint8Array(await f.arrayBuffer()) : null;
    },
    async delete(key) {
      await unlink(at(key)).catch(e => {
        if (e.code !== "ENOENT") throw e;
      });
    },
    link: () => null,
  };
}

export const store: Store = process.env.S3_BUCKET ? s3Store(process.env) : localStore(process.env);
