import { expect, test } from "@playwright/test";
import { seedAdmin } from "../tests/support/test-database";

const { username, password, displayName } = seedAdmin;

test("管理员登录后进入空首页", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "登录" })).toBeVisible();

  await page.getByLabel("用户名").fill(username);
  await page.getByLabel("密码").fill(password);
  await page.getByRole("button", { name: "登录" }).click();

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: `欢迎，${displayName}` })).toBeVisible();
  await expect(page.getByText("还没有业务数据")).toBeVisible();
});