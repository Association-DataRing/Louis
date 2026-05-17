import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

const endpoint = process.env.S3_ENDPOINT;
const region = process.env.S3_REGION ?? "eu-west-3";
const bucket = process.env.S3_BUCKET ?? "louis";
const accessKeyId = process.env.S3_ACCESS_KEY_ID ?? "";
const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY ?? "";
const forcePathStyle =
  process.env.S3_FORCE_PATH_STYLE === "true" || endpoint?.includes("localhost");

let client: S3Client | null = null;
let bucketEnsured = false;

function getClient(): S3Client {
  if (!client) {
    client = new S3Client({
      region,
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle,
    });
  }
  return client;
}

async function ensureBucket(): Promise<void> {
  if (bucketEnsured) return;
  const c = getClient();
  try {
    await c.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch {
    await c.send(new CreateBucketCommand({ Bucket: bucket }));
  }
  bucketEnsured = true;
}

export async function uploadObject(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string
): Promise<void> {
  await ensureBucket();
  await getClient().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
}

export async function deleteObject(key: string): Promise<void> {
  await getClient().send(
    new DeleteObjectCommand({ Bucket: bucket, Key: key })
  );
}

export async function getObjectBytes(key: string): Promise<Uint8Array> {
  const res = await getClient().send(
    new GetObjectCommand({ Bucket: bucket, Key: key })
  );
  if (!res.Body) throw new Error("Empty body");
  return res.Body.transformToByteArray();
}

