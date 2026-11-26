import type { SqlClient } from "@jxc/access-control";
import { query } from "./db";

/** 把应用的 pg 连接池收窄成领域包需要的查询口。 */
export const accessStore: SqlClient = {
  query: (text, values = []) => query(text, [...values]),
};
