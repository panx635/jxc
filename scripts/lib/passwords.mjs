import { hash } from "@node-rs/argon2";

// 参数与 apps/web/src/server/password.ts 保持一致；改一处必须改另一处。
export const ARGON2_OPTIONS = Object.freeze({
  // Argon2id（数值与 @node-rs/argon2 的 Algorithm.Argon2id 一致）
  algorithm: 2,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
});

export function hashPassword(password) {
  return hash(password, ARGON2_OPTIONS);
}