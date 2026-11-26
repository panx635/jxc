import { hash, verify } from "@node-rs/argon2";

const ARGON2_OPTIONS = {
  // Algorithm.Argon2id（@node-rs/argon2 在 isolatedModules 下不能引 const enum）
  algorithm: 2,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

export async function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password, ARGON2_OPTIONS);
  } catch {
    return false;
  }
}

let dummyHash: Promise<string> | undefined;

/** 用户不存在时也做一次等价耗时的校验，避免按响应时间枚举账号。 */
export async function verifyAgainstDummy(password: string): Promise<false> {
  dummyHash ??= hashPassword("jxc-dummy-password-not-a-real-account");
  await verifyPassword(await dummyHash, password);
  return false;
}