/** @type {import('next').NextConfig} */
const nextConfig = {
  // "standalone" = Next tự gom server + dependency tối thiểu → Docker image nhỏ, hợp Cloud Run
  output: 'standalone',
};

export default nextConfig;
