/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The API is a separate Vercel project, so nothing is proxied through Next.
  // NEXT_PUBLIC_API_URL points the browser straight at it.
  eslint: { ignoreDuringBuilds: false },
};

export default nextConfig;
