"use client";

interface Stats {
	totalWorkshops: number;
	totalCertificates: number;
	totalTemplates: number;
}

interface Cert {
	id: string;
	name: string;
	email: string;
	issuedAt: Date;
	workshopTitle: string;
	workshopCode: string;
	workshopDate: string;
}

export function AdminDashboardClient({
	stats,
	certs,
}: {
	stats: Stats;
	certs: Cert[];
}) {
	return (
		<div className="animate-fade-in-up">
			<h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

			{/* Stats */}
			<div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
				<StatCard
					label="Total Certificates"
					value={stats.totalCertificates}
					emoji="📜"
				/>
				<StatCard
					label="Workshops"
					value={stats.totalWorkshops}
					emoji="🎓"
				/>
				<StatCard
					label="Templates"
					value={stats.totalTemplates}
					emoji="🖼️"
				/>
			</div>

			{/* Recent Certificates */}
			<div className="glass-card rounded-2xl overflow-hidden">
				<div className="px-6 py-4 border-b border-gray-100">
					<h2 className="text-lg font-semibold text-gray-900">
						Recent Certificates
					</h2>
				</div>
				{certs.length === 0 ? (
					<div className="p-12 text-center text-gray-400">
						<div className="text-3xl mb-2">📭</div>
						No certificates generated yet.
					</div>
				) : (
					<div className="overflow-x-auto">
						<table className="w-full text-sm">
							<thead>
								<tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
									<th className="px-6 py-3 text-left font-semibold">Name</th>
									<th className="px-6 py-3 text-left font-semibold">Email</th>
									<th className="px-6 py-3 text-left font-semibold">
										Workshop
									</th>
									<th className="px-6 py-3 text-left font-semibold">Issued</th>
									<th className="px-6 py-3 text-left font-semibold">Actions</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-gray-50">
								{certs.map((cert) => (
									<tr key={cert.id} className="hover:bg-gray-50/50">
										<td className="px-6 py-3 font-medium text-gray-900">
											{cert.name}
										</td>
										<td className="px-6 py-3 text-gray-600">{cert.email}</td>
										<td className="px-6 py-3">
											<span className="inline-flex items-center gap-1.5">
												<span className="px-2 py-0.5 rounded-md bg-orange-50 text-[#D4900F] text-xs font-semibold">
													{cert.workshopCode}
												</span>
												<span className="text-gray-600">
													{cert.workshopTitle}
												</span>
											</span>
										</td>
										<td className="px-6 py-3 text-gray-500">
											{new Date(cert.issuedAt).toLocaleDateString()}
										</td>
										<td className="px-6 py-3">
											<a
												href={`/api/certificates/${cert.id}/download`}
												download
												className="text-[#F5A623] hover:underline text-xs font-medium"
											>
												Download
											</a>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</div>
		</div>
	);
}

function StatCard({
	label,
	value,
	emoji,
}: {
	label: string;
	value: number;
	emoji: string;
}) {
	return (
		<div className="glass-card rounded-xl p-5">
			<div className="flex items-center gap-3">
				<span className="text-2xl">{emoji}</span>
				<div>
					<p className="text-2xl font-bold text-gray-900">{value}</p>
					<p className="text-xs text-gray-500 font-medium">{label}</p>
				</div>
			</div>
		</div>
	);
}
