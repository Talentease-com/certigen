"use client";

import { useState, useSyncExternalStore } from "react";

const DISMISS_KEY = "certigen-editor-guide-dismissed";

// Reads the persisted dismissal without an effect+setState round trip (which
// would also mismatch between server and client renders). Defaults to
// "not dismissed" on the server/first paint, then syncs to localStorage.
function usePersistedDismissed() {
	return useSyncExternalStore(
		() => () => {},
		() => localStorage.getItem(DISMISS_KEY) === "1",
		() => false,
	);
}

function DragResizeIllustration() {
	return (
		<svg viewBox="0 0 200 120" className="w-32 h-20 shrink-0" aria-hidden="true">
			<rect
				x="30"
				y="20"
				width="140"
				height="80"
				rx="8"
				fill="rgba(245,166,35,0.08)"
				stroke="#F5A623"
				strokeWidth="2"
				strokeDasharray="6 5"
			/>
			{[
				[30, 20],
				[170, 20],
				[30, 100],
				[170, 100],
			].map(([cx, cy]) => (
				<rect
					key={`${cx}-${cy}`}
					x={cx - 5}
					y={cy - 5}
					width="10"
					height="10"
					rx="2"
					fill="#F5A623"
				/>
			))}
			<g
				transform="translate(100,60)"
				stroke="#D0021B"
				strokeWidth="2.5"
				fill="none"
				strokeLinecap="round"
				strokeLinejoin="round"
			>
				<path d="M0,-16 L0,16 M-16,0 L16,0" />
				<path d="M-5,-11 L0,-16 L5,-11" />
				<path d="M-5,11 L0,16 L5,11" />
				<path d="M-11,-5 L-16,0 L-11,5" />
				<path d="M11,-5 L16,0 L11,5" />
			</g>
		</svg>
	);
}

export function EditorGuide() {
	const persistedDismissed = usePersistedDismissed();
	const [dismissedThisSession, setDismissedThisSession] = useState(false);

	if (persistedDismissed || dismissedThisSession) return null;

	const dismiss = () => {
		localStorage.setItem(DISMISS_KEY, "1");
		setDismissedThisSession(true);
	};

	return (
		<div className="glass-card rounded-xl p-4 mb-4 flex items-center gap-4">
			<DragResizeIllustration />
			<div className="flex-1 text-sm text-gray-600">
				<p className="font-semibold text-gray-900 mb-1">How to place elements</p>
				<p>
					<strong>Click</strong> an element to select it, <strong>drag</strong> it
					to move, and <strong>drag a corner handle</strong> to resize. Use the
					panel on the right to change its font, size, color, and layering.
				</p>
			</div>
			<button
				type="button"
				onClick={dismiss}
				className="text-xs text-gray-400 hover:text-gray-600 shrink-0 self-start"
			>
				Got it, hide this
			</button>
		</div>
	);
}
