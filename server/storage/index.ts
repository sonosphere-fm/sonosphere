import { S3Client } from "bun";
import { mkdir, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import { retryS3Delete } from "./retry";

interface Store {
  put(key: string, data: Uint8Array, type: string): Promise<void>;
  get(key: string): Promise<Uint8Array<ArrayBuffer> | null>;
  delete(key: string): Promise<void>;
}

const checked = (key: string) => {
  if (!/^[a-z0-9][a-z0-9/_-]*\.[a-z0-9]+$/.test(key) || key.includes("//")) throw new Error(`bad storage key: ${key}`);
  return key;
};

function s3Store(env: NodeJS.ProcessEnv): Store {
  const endpoint = env.S3_ENDPOINT || `https://s3.${env.S3_REGION || "us-east-1"}.amazonaws.com`;
  const accessKeyId = env.S3_ACCESS_KEY_ID;
  const secretAccessKey = env.S3_SECRET_ACCESS_KEY;
  if (!accessKeyId || !secretAccessKey)
    throw new Error("S3_BUCKET is set but S3_ACCESS_KEY_ID or S3_SECRET_ACCESS_KEY is missing");
  const client = new S3Client({
    endpoint,
    bucket: env.S3_BUCKET,
    region: env.S3_REGION || "auto",
    accessKeyId,
    secretAccessKey,
  });
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
      const validKey = checked(key);
      await retryS3Delete(() => client.delete(validKey));
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
      await unlink(at(key)).catch((e) => {
        if (e.code !== "ENOENT") throw e;
      });
    },
  };
}

export const store: Store = process.env.S3_BUCKET ? s3Store(process.env) : localStore(process.env);
