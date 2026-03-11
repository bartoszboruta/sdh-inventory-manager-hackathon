import { useEffect, useState } from "react";
import { skipToken } from "@tanstack/react-query";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/components/ui/select";
import { api } from "~/utils/api";

import { OfficeLayoutGrid } from "./components/office-layout-grid";
import { EmployeePage } from "../layout/employee-page";
import { getCellKey } from "./game-tiles";

type PlayerPosition = { x: number; y: number };

export function EmployeeGameModePage() {
	const [selectedOfficeId, setSelectedOfficeId] = useState<string>();
	const [playerPosition, setPlayerPosition] = useState<PlayerPosition>();
	const options = api.game.employeeListAvailableOfficeLayouts.useQuery();
	const layout = api.game.employeeGetOfficeLayout.useQuery(
		selectedOfficeId ? { officeId: selectedOfficeId } : skipToken,
	);

	useEffect(() => {
		if (selectedOfficeId) return;
		const first = options.data?.[0];
		if (first) {
			setSelectedOfficeId(first.officeId);
		}
	}, [options.data, selectedOfficeId]);

	useEffect(() => {
		const data = layout.data;
		if (!data) {
			setPlayerPosition(undefined);
			return;
		}

		const walkableKeys = Object.keys(data.baseLayer);
		if (walkableKeys.length === 0) {
			setPlayerPosition(undefined);
			return;
		}

		setPlayerPosition((current) => {
			if (current && data.baseLayer[getCellKey(current.x, current.y)]) {
				return current;
			}

			const [firstKey] = walkableKeys;
			if (!firstKey) return undefined;
			const [xRaw, yRaw] = firstKey.split(",");
			const x = Number(xRaw);
			const y = Number(yRaw);
			if (!Number.isInteger(x) || !Number.isInteger(y)) {
				return undefined;
			}

			return { x, y };
		});
	}, [layout.data, selectedOfficeId]);

	useEffect(() => {
		const data = layout.data;
		if (!data) return;

		const handleKeyDown = (event: KeyboardEvent) => {
			const target = event.target;
			if (
				target instanceof HTMLElement &&
				(target.tagName === "INPUT" ||
					target.tagName === "TEXTAREA" ||
					target.tagName === "SELECT" ||
					target.isContentEditable)
			) {
				return;
			}

			const deltaByKey: Record<string, { x: number; y: number }> = {
				ArrowUp: { x: 0, y: -1 },
				ArrowDown: { x: 0, y: 1 },
				ArrowLeft: { x: -1, y: 0 },
				ArrowRight: { x: 1, y: 0 },
			};
			const delta = deltaByKey[event.key];
			if (!delta) return;
			event.preventDefault();

			setPlayerPosition((current) => {
				if (!current) return current;

				const nextX = current.x + delta.x;
				const nextY = current.y + delta.y;
				const isWithinGrid =
					nextX >= 0 && nextX < data.width && nextY >= 0 && nextY < data.height;
				if (!isWithinGrid) {
					return current;
				}

				return data.baseLayer[getCellKey(nextX, nextY)]
					? { x: nextX, y: nextY }
					: current;
			});
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [layout.data]);

	return (
		<EmployeePage
			title="Game Mode"
			description="Explore office layouts created by your manager"
		>
			<Card>
				<CardHeader>
					<CardTitle>Office layout viewer</CardTitle>
					<CardDescription>Select office and view map in read-only mode.</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<Select value={selectedOfficeId} onValueChange={(value) => setSelectedOfficeId(value)}>
						<SelectTrigger className="max-w-sm">
							<SelectValue placeholder="Select office" />
						</SelectTrigger>
						<SelectContent>
							{(options.data ?? []).map((office) => (
								<SelectItem key={office.officeId} value={office.officeId}>
									{office.officeName} ({office.width}x{office.height})
								</SelectItem>
							))}
						</SelectContent>
					</Select>

					<div className="overflow-auto">
						{layout.isLoading ? (
							<p className="text-sm text-muted-foreground">Loading layout...</p>
						) : !layout.data ? (
							<p className="text-sm text-muted-foreground">
								No layout available for selected office yet.
							</p>
						) : (
							<OfficeLayoutGrid
								layout={layout.data}
								cellSize={24}
								playerPosition={playerPosition}
							/>
						)}
					</div>
				</CardContent>
			</Card>
		</EmployeePage>
	);
}
