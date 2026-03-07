import { listTemplates } from "@/actions/template-actions";
import { TemplatesClient } from "@/components/admin-templates";

export default async function TemplatesPage() {
	const templatesList = await listTemplates();
	return <TemplatesClient initialTemplates={templatesList} />;
}
