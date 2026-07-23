-- Templates move from a flat placeholders array (name/workshop_title/date
-- with a hardcoded Y position each, QR hardcoded separately in code) to a
-- layered `design` document (see src/lib/certificate-design.ts) that also
-- supports free-form text and images.
--
-- This adds the column and backfills it from each template's existing
-- `placeholders`, converting every entry into a bound text element and
-- appending a QR element at the same bottom-right position/size the old
-- renderer always used — so existing templates keep rendering identically
-- until an admin opens the new canvas editor and changes anything.
--
-- The backfill only touches rows where `design` is still NULL, so re-running
-- this against a database that already has real design data (e.g. templates
-- already edited in the canvas editor) never overwrites it.
ALTER TABLE "templates" ADD COLUMN IF NOT EXISTS "design" text;

UPDATE "templates" AS t
SET "design" = (
	COALESCE(
		(
			SELECT jsonb_agg(
				jsonb_build_object(
					'id', 'legacy-' || p.idx::text,
					'type', 'text',
					'boundTo', p.elem->>'key',
					'content', '',
					'x', COALESCE((p.elem->>'x')::numeric, 0),
					'y', COALESCE((p.elem->>'y')::numeric, 0),
					'width', t.width,
					'height', COALESCE((p.elem->>'fontSize')::numeric, 48) * 2,
					'rotation', 0,
					'zIndex', p.idx,
					'opacity', 1,
					'fontFamily', COALESCE(p.elem->>'fontFamily', 'Inter'),
					'fontSize', COALESCE((p.elem->>'fontSize')::numeric, 48),
					'color', COALESCE(p.elem->>'color', '#333333'),
					'align', COALESCE(p.elem->>'align', 'center')
				)
			)
			FROM jsonb_array_elements(
				COALESCE(NULLIF(t."placeholders", '')::jsonb, '[]'::jsonb)
			) WITH ORDINALITY AS p(elem, idx)
		),
		'[]'::jsonb
	)
	||
	jsonb_build_array(
		jsonb_build_object(
			'id', 'legacy-qr',
			'type', 'qr',
			'x', t."width" - 320,
			'y', t."height" - 320,
			'width', 280,
			'height', 280,
			'rotation', 0,
			'zIndex', 999,
			'opacity', 1
		)
	)
) :: text
WHERE t."design" IS NULL;

ALTER TABLE "templates" ALTER COLUMN "design" SET DEFAULT '{"elements":[]}';
ALTER TABLE "templates" ALTER COLUMN "design" SET NOT NULL;
ALTER TABLE "templates" DROP COLUMN IF EXISTS "placeholders";
