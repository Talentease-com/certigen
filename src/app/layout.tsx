import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
	title: "Certigen — Talentease Certificate Platform",
	description:
		"Generate and verify certificates of completion for Talentease workshops.",
	manifest: "/manifest.json",
	openGraph: {
		title: "Certigen — Talentease",
		description: "Certificate generation platform for Talentease workshops.",
	},
};

export const viewport = {
	width: "device-width",
	initialScale: 1,
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="en">
			<body className="font-sans antialiased min-h-screen flex flex-col">
				{children}
			</body>
		</html>
	);
}
