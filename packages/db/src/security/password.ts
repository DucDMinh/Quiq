import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

// Định dạng lưu: scrypt$N$r$p$salt$hash (salt, hash là base64url). Lưu kèm tham số để sau này
// tăng độ khó mà vẫn kiểm được mật khẩu cũ.
const SCRYPT_COST = 16384; // N
const SCRYPT_BLOCK_SIZE = 8; // r
const SCRYPT_PARALLELISM = 1; // p
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

// Chặn tham số quá lớn trong chuỗi hash (dữ liệu hỏng/bị sửa) làm cạn bộ nhớ lúc verify.
const MAX_COST = 2 ** 17;
const MAX_BLOCK_SIZE = 16;
const MAX_PARALLELISM = 4;
const MIN_KEY_LENGTH = 16;
const MAX_KEY_LENGTH = 128;
const MAX_SALT_LENGTH = 64;

interface ScryptParams {
  cost: number;
  blockSize: number;
  parallelism: number;
}

function deriveKey(password: string, salt: Buffer, params: ScryptParams, keyLength: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      keyLength,
      {
        N: params.cost,
        r: params.blockSize,
        p: params.parallelism,
        maxmem: 256 * params.cost * params.blockSize,
      },
      (error, key) => (error ? reject(error) : resolve(key)),
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const params = { cost: SCRYPT_COST, blockSize: SCRYPT_BLOCK_SIZE, parallelism: SCRYPT_PARALLELISM };
  const key = await deriveKey(password, salt, params, KEY_LENGTH);
  return [
    "scrypt",
    params.cost,
    params.blockSize,
    params.parallelism,
    salt.toString("base64url"),
    key.toString("base64url"),
  ].join("$");
}

function inRange(value: number, min: number, max: number): boolean {
  return Number.isInteger(value) && value >= min && value <= max;
}

interface ParsedHash {
  params: ScryptParams;
  salt: Buffer;
  expected: Buffer;
}

// Độ dài base64url tối đa tương ứng MAX_KEY_LENGTH / MAX_SALT_LENGTH byte; kiểm trước khi giải mã để chuỗi rác khổng lồ không tốn bộ nhớ.
const base64UrlLength = (bytes: number) => Math.ceil((bytes * 4) / 3);

/** Tách và kiểm tra chuỗi đã lưu; trả null với mọi định dạng hoặc tham số không hợp lệ. */
function parseStoredHash(stored: string): ParsedHash | null {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return null;
  const [, cost, blockSize, parallelism, saltText = "", hashText = ""] = parts;
  const params = { cost: Number(cost), blockSize: Number(blockSize), parallelism: Number(parallelism) };
  const validParams =
    // scrypt của Node yêu cầu N là lũy thừa của 2 và lớn hơn 1.
    inRange(params.cost, 2, MAX_COST) &&
    Number.isInteger(Math.log2(params.cost)) &&
    inRange(params.blockSize, 1, MAX_BLOCK_SIZE) &&
    inRange(params.parallelism, 1, MAX_PARALLELISM);
  if (!validParams) return null;
  if (saltText.length > base64UrlLength(MAX_SALT_LENGTH) || hashText.length > base64UrlLength(MAX_KEY_LENGTH)) {
    return null;
  }
  const salt = Buffer.from(saltText, "base64url");
  const expected = Buffer.from(hashText, "base64url");
  if (salt.length === 0 || !inRange(expected.length, MIN_KEY_LENGTH, MAX_KEY_LENGTH)) return null;
  return { params, salt, expected };
}

/** Trả false (không bao giờ ném lỗi) với mọi chuỗi hash sai định dạng để tầng đăng nhập chỉ cần xử lý đúng/sai. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parsed = parseStoredHash(stored);
  if (!parsed) return false;
  try {
    const actual = await deriveKey(password, parsed.salt, parsed.params, parsed.expected.length);
    // Cùng độ dài theo cách dựng ở trên nên timingSafeEqual không ném lỗi; so sánh hằng thời gian.
    return timingSafeEqual(actual, parsed.expected);
  } catch {
    // Phòng khi scrypt vẫn từ chối tổ hợp tham số (vd. vượt maxmem): coi như hash không hợp lệ.
    return false;
  }
}
