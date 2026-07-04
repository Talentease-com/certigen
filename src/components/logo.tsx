import Link from "next/link";

export function Logo({ className = "text-2xl" }: { className?: string }) {
	return (
		<Link
			href="/"
			className={`font-bold hover:opacity-80 transition-opacity ${className}`}
		>
			<span className="text-[#F5A623]">talent</span>
			<span className="text-[#D0021B]">e</span>
			<span className="text-[#F5A623]">ase</span>
		</Link>
	);
}
