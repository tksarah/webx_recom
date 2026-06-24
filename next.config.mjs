/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  serverExternalPackages: ["pdfkit"],
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
