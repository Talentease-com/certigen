import { getWorkshopStats, listCertificates } from "@/actions/workshop-actions";
import { AdminDashboardClient } from "@/components/admin-dashboard";

export default async function AdminDashboardPage() {
	const [stats, certs] = await Promise.all([
		getWorkshopStats(),
		listCertificates(),
	]);

	return <AdminDashboardClient stats={stats} certs={certs} />;
}
