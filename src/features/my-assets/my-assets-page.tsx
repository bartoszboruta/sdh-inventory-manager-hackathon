import Link from "next/link";

import { Badge } from "~/components/ui/badge";
import { buttonVariants } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/components/ui/table";
import { api } from "~/utils/api";

import { EmployeePage } from "../layout/employee-page";

export function MyAssetsPage() {
	const myAssets = api.asset.myAssets.useQuery();

	return (
		<EmployeePage
			title="My Assets"
			description="Equipment currently assigned to your profile"
		>
			<div className="flex justify-end">
				<Link href="/game-mode" className={buttonVariants({ variant: "outline" })}>
					Open Game Mode
				</Link>
			</div>
			<Card>
				<CardHeader>
					<CardTitle>Assigned inventory</CardTitle>
					<CardDescription>
						Current active equipment checked out to you.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Name</TableHead>
								<TableHead>Barcode</TableHead>
								<TableHead>Category</TableHead>
								<TableHead>Status</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{(myAssets.data ?? []).map((asset) => (
								<TableRow key={asset.id}>
									<TableCell>{asset.name}</TableCell>
									<TableCell>{asset.barcode}</TableCell>
									<TableCell>{asset.category}</TableCell>
									<TableCell>
										<Badge>{asset.status}</Badge>
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</CardContent>
			</Card>
		</EmployeePage>
	);
}
