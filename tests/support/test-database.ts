export const LOCAL_TEST_DATABASE_URL = "postgresql://postgres@127.0.0.1:55432/jxc_test";

/**
 * 测试只碰专用库：本地默认 jxc_test；CI 用 service 容器的 jxc_test；
 * 需要别的测试库时显式设置 JXC_TEST_DATABASE_URL，绝不隐式复用 DATABASE_URL。
 */
export const testDatabaseUrl =
  process.env.JXC_TEST_DATABASE_URL ||
  (process.env.CI && process.env.DATABASE_URL) ||
  LOCAL_TEST_DATABASE_URL;

export const seedAdmin = {
  username: process.env.SEED_ADMIN_USERNAME || "admin",
  password: process.env.SEED_ADMIN_PASSWORD || "admin12345",
  displayName: process.env.SEED_ADMIN_DISPLAY_NAME || "管理员",
};

export function testSetupEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    DATABASE_URL: testDatabaseUrl,
    SEED_ADMIN_USERNAME: seedAdmin.username,
    SEED_ADMIN_PASSWORD: seedAdmin.password,
    SEED_ADMIN_DISPLAY_NAME: seedAdmin.displayName,
    SEED_SHOP_NAME: process.env.SEED_SHOP_NAME || "五金水暖",
  };
}
