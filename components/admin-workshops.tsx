"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
	createWorkshop,
	updateWorkshop,
	deleteWorkshop,
} from "@/actions/workshop-actions";

type Workshop = {
	id: string;
	code: string;
	title: string;
	date: string;
	templateId: string | null;
	isActive: boolean;
	createdAt: Date;
};

type Template = {
	id: string;
	name: string;
};

export function WorkshopsClient({
	initialWorkshops,
	initialTemplates,
}: {
	initialWorkshops: Workshop[];
	initialTemplates: Template[];
}) {
	const router = useRouter();
	const [showCreate, setShowCreate] = useState(false);
	const [editingWorkshop, setEditingWorkshop] = useState<Workshop | null>(null);
	const [form, setForm] = useState({
		code: "",
		title: "",
		date: "",
		templateId: "",
	});
	const [editForm, setEditForm] = useState({
		title: "",
		date: "",
		templateId: "",
	});
	const [submitting, setSubmitting] = useState(false);

	const handleCreate = async (e: React.FormEvent) => {
		e.preventDefault();
		setSubmitting(true);
		try {
			await createWorkshop(form);
			setForm({ code: "", title: "", date: "", templateId: "" });
			setShowCreate(false);
			router.refresh();
		} catch (err) {
			alert(err instanceof Error ? err.message : "Failed to create workshop");
		} finally {
			setSubmitting(false);
		}
	};

	const toggleActive = async (id: string, currentlyActive: boolean) => {
		try {
			await updateWorkshop({ id, isActive: !currentlyActive });
			router.refresh();
		} catch (err) {
			console.error(err);
		}
	};

	const openEdit = (w: Workshop) => {
		setEditingWorkshop(w);
		setEditForm({
			title: w.title,
			date: w.date,
			templateId: w.templateId || "",
		});
	};

	const handleEdit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!editingWorkshop) return;
		setSubmitting(true);
		try {
			await updateWorkshop({
				id: editingWorkshop.id,
				title: editForm.title,
				date: editForm.date,
				templateId: editForm.templateId,
			});
			setEditingWorkshop(null);
			router.refresh();
		} catch (err) {
			alert(err instanceof Error ? err.message : "Failed to update workshop");
		} finally {
			setSubmitting(false);
		}
	};

	const handleDelete = async (w: Workshop) => {
		if (
			!confirm(
				`Delete workshop "${w.code}"? This only works if no certificates have been issued.`,
			)
		)
			return;
		try {
			await deleteWorkshop(w.id);
			router.refresh();
		} catch (err) {
			alert(err instanceof Error ? err.message : "Failed to delete workshop");
		}
	};

	const getTemplateName = (id: string | null) =>
		initialTemplates.find((t) => t.id === id)?.name || "—";

	return (
		<div className="animate-fade-in-up">
			<div className="flex items-center justify-between mb-6">
				<h1 className="text-2xl font-bold text-gray-900">Workshops</h1>
				<button
					type="button"
					className="btn-primary text-sm"
					onClick={() => setShowCreate(!showCreate)}
				>
					{showCreate ? "Cancel" : "+ New Workshop"}
				</button>
			</div>

			{/* Create Form */}
			{showCreate && (
				<form
					onSubmit={handleCreate}
					className="glass-card rounded-2xl p-6 mb-6 animate-scale-in"
				>
					<h3 className="font-semibold text-gray-900 mb-4">Create Workshop</h3>
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
						<div>
							<label className="block text-sm font-medium text-gray-700 mb-1">
								Workshop Code
							</label>
							<input
								type="text"
								value={form.code}
								onChange={(e) =>
									setForm({ ...form, code: e.target.value.toUpperCase() })
								}
								placeholder="WS-REACT-001"
								className="input-field uppercase"
								required
							/>
						</div>
						<div>
							<label className="block text-sm font-medium text-gray-700 mb-1">
								Title
							</label>
							<input
								type="text"
								value={form.title}
								onChange={(e) => setForm({ ...form, title: e.target.value })}
								placeholder="React Fundamentals Workshop"
								className="input-field"
								required
							/>
						</div>
						<div>
							<label className="block text-sm font-medium text-gray-700 mb-1">
								Date
							</label>
							<input
								type="date"
								value={form.date}
								onChange={(e) => setForm({ ...form, date: e.target.value })}
								className="input-field"
								required
							/>
						</div>
						<div>
							<label className="block text-sm font-medium text-gray-700 mb-1">
								Template
							</label>
							<select
								value={form.templateId}
								onChange={(e) =>
									setForm({ ...form, templateId: e.target.value })
								}
								className="input-field"
								required
							>
								<option value="">Select a template...</option>
								{initialTemplates.map((t) => (
									<option key={t.id} value={t.id}>
										{t.name}
									</option>
								))}
							</select>
						</div>
					</div>
					<button
						type="submit"
						className="btn-primary text-sm"
						disabled={submitting}
					>
						{submitting ? "Creating..." : "Create Workshop"}
					</button>
				</form>
			)}

			{/* Workshops List */}
			<div className="glass-card rounded-2xl overflow-hidden">
				{initialWorkshops.length === 0 ? (
					<div className="p-12 text-center text-gray-400">
						<div className="text-3xl mb-2">&#x1F393;</div>
						No workshops yet. Create your first one above.
					</div>
				) : (
					<div className="overflow-x-auto">
						<table className="w-full text-sm">
							<thead>
								<tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
									<th className="px-6 py-3 text-left font-semibold">Code</th>
									<th className="px-6 py-3 text-left font-semibold">Title</th>
									<th className="px-6 py-3 text-left font-semibold">Date</th>
									<th className="px-6 py-3 text-left font-semibold">
										Template
									</th>
									<th className="px-6 py-3 text-left font-semibold">Status</th>
									<th className="px-6 py-3 text-left font-semibold">Actions</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-gray-50">
								{initialWorkshops.map((w) => (
									<tr key={w.id} className="hover:bg-gray-50/50">
										<td className="px-6 py-3">
											<span className="px-2 py-0.5 rounded-md bg-orange-50 text-[#D4900F] text-xs font-bold font-mono">
												{w.code}
											</span>
										</td>
										<td className="px-6 py-3 font-medium text-gray-900">
											{w.title}
										</td>
										<td className="px-6 py-3 text-gray-500">{w.date}</td>
										<td className="px-6 py-3 text-gray-500 text-xs">
											{getTemplateName(w.templateId)}
										</td>
										<td className="px-6 py-3">
											<span
												className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
													w.isActive
														? "bg-green-50 text-green-700"
														: "bg-gray-100 text-gray-500"
												}`}
											>
												<span
													className={`w-1.5 h-1.5 rounded-full ${w.isActive ? "bg-green-500" : "bg-gray-400"}`}
												/>
												{w.isActive ? "Active" : "Inactive"}
											</span>
										</td>
										<td className="px-6 py-3">
											<div className="flex items-center gap-3">
												<button
													type="button"
													className="text-xs font-medium text-blue-500 hover:text-blue-700 transition-colors"
													onClick={() => openEdit(w)}
												>
													Edit
												</button>
												<button
													type="button"
													className="text-xs font-medium text-gray-500 hover:text-gray-900 transition-colors"
													onClick={() => toggleActive(w.id, w.isActive)}
												>
													{w.isActive ? "Deactivate" : "Activate"}
												</button>
												<button
													type="button"
													className="text-xs font-medium text-red-400 hover:text-red-600 transition-colors"
													onClick={() => handleDelete(w)}
												>
													Delete
												</button>
											</div>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</div>

			{/* Edit Modal */}
			{editingWorkshop && (
				<div
					className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
					onClick={(e) => {
						if (e.target === e.currentTarget) setEditingWorkshop(null);
					}}
				>
					<form
						onSubmit={handleEdit}
						className="bg-white rounded-2xl shadow-2xl max-w-md w-full animate-scale-in overflow-hidden"
					>
						<div className="bg-gradient-to-r from-[#F5A623] to-[#D0021B] px-6 py-4">
							<h3 className="text-lg font-bold text-white">Edit Workshop</h3>
							<p className="text-white/80 text-xs font-mono mt-0.5">
								{editingWorkshop.code}
							</p>
						</div>
						<div className="px-6 py-5 space-y-4">
							<div>
								<label className="block text-sm font-medium text-gray-700 mb-1">
									Title
								</label>
								<input
									type="text"
									value={editForm.title}
									onChange={(e) =>
										setEditForm({ ...editForm, title: e.target.value })
									}
									className="input-field"
									required
								/>
							</div>
							<div>
								<label className="block text-sm font-medium text-gray-700 mb-1">
									Date
								</label>
								<input
									type="date"
									value={editForm.date}
									onChange={(e) =>
										setEditForm({ ...editForm, date: e.target.value })
									}
									className="input-field"
									required
								/>
							</div>
							<div>
								<label className="block text-sm font-medium text-gray-700 mb-1">
									Template
								</label>
								<select
									value={editForm.templateId}
									onChange={(e) =>
										setEditForm({ ...editForm, templateId: e.target.value })
									}
									className="input-field"
									required
								>
									<option value="">Select a template...</option>
									{initialTemplates.map((t) => (
										<option key={t.id} value={t.id}>
											{t.name}
										</option>
									))}
								</select>
							</div>
						</div>
						<div className="px-6 py-4 bg-gray-50 flex gap-3 border-t border-gray-100">
							<button
								type="button"
								className="btn-secondary flex-1"
								onClick={() => setEditingWorkshop(null)}
							>
								Cancel
							</button>
							<button
								type="submit"
								className="btn-primary flex-1"
								disabled={submitting}
							>
								{submitting ? "Saving..." : "Save Changes"}
							</button>
						</div>
					</form>
				</div>
			)}
		</div>
	);
}
