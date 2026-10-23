/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    // HTML ve veri shim'i her açılışta yeniden doğrulansın (eski qx-direct.js / sayfa önbellekte kalmasın)
    const nc = [{ key: "Cache-Control", value: "no-cache, must-revalidate" }];
    return [
      { source: "/quantex.html", headers: nc },
      { source: "/radar.html", headers: nc },
      { source: "/qx-direct.js", headers: nc },
      { source: "/qx-nav.js", headers: nc },
    ];
  },
  webpack: (config) => {
    config.resolve.fallback = { ...config.resolve.fallback, fs: false, net: false, tls: false };
    return config;
  },
};

export default nextConfig;
