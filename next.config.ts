import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	serverExternalPackages: ["sharp", "fontkit"],
	experimental: {
		serverActions: {
			bodySizeLimit: "20mb",
		},
	},
	outputFileTracingIncludes: {
		"/api/certificates/[id]/download": ["./fonts/**/*.ttf"],
		"/workshop/[code]": ["./fonts/**/*.ttf"],
		"/admin/templates": ["./fonts/**/*.ttf"],
	},
};

export default nextConfig;
