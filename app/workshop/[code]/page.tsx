import { getWorkshopByCode } from "@/actions/certificate-actions";
import { WorkshopFormClient } from "@/components/workshop-form";
import { WorkshopNotFound } from "@/components/workshop-not-found";

export const maxDuration = 30;

export default async function WorkshopPage({
	params,
}: {
	params: Promise<{ code: string }>;
}) {
	const { code } = await params;
	const workshop = await getWorkshopByCode(code);

	if (!workshop) {
		return <WorkshopNotFound requestedCode={code} />;
	}

	return <WorkshopFormClient workshop={workshop} />;
}
