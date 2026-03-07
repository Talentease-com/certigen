import { listWorkshops } from "@/actions/workshop-actions";
import { listTemplates } from "@/actions/template-actions";
import { WorkshopsClient } from "@/components/admin-workshops";

export default async function WorkshopsPage() {
	const [workshopsList, templatesList] = await Promise.all([
		listWorkshops(),
		listTemplates(),
	]);

	return (
		<WorkshopsClient
			initialWorkshops={workshopsList}
			initialTemplates={templatesList}
		/>
	);
}
