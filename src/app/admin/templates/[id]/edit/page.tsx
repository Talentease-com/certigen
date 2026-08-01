"use client";

import { use } from "react";
import { TemplateEditorClient } from "./template-editor-client";

export default function TemplateEditPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = use(params);
	return <TemplateEditorClient templateId={id} />;
}
