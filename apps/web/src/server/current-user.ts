import { cache } from "react";
import { getSessionUser } from "./session";

/** 一次请求内复用会话查询（布局与页面都会读当前用户）。 */
export const getCurrentUser = cache(getSessionUser);
