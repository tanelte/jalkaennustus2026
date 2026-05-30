import type { NextConfig } from 'next';
import { resolve } from 'node:path';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Lock the workspace root to this project to silence the multi-lockfile inference.
  outputFileTracingRoot: resolve(__dirname),
};

export default nextConfig;
