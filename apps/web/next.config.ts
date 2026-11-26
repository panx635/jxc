import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  transpilePackages: [
    "@jxc/master-data",
    "@jxc/document-core",
    "@jxc/inventory-ledger",
    "@jxc/party-ledger",
    "@jxc/cash-ledger",
    "@jxc/reporting",
    "@jxc/printing",
    "@jxc/access-control",
    "@jxc/opening-import",
  ],
  serverExternalPackages: ["@node-rs/argon2", "pg"],
};

export default nextConfig;
