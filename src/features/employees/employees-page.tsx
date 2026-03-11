import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "~/components/ui/table";
import { api } from "~/utils/api";
import {
	EMPTY_SERVER_ERRORS,
	extractServerFormErrors,
	inputErrorClass,
} from "~/lib/form-errors";
import { AssetStatus } from "~/types/contracts";

import { ManagerPage } from "../layout/manager-page";

export function EmployeesPage() {
	const utils = api.useUtils();
	const employees = api.employee.list.useQuery({ page: 1, pageSize: 100 });
	const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>();
	const employeeAssets = api.asset.list.useQuery(
		{
			page: 1,
			pageSize: 100,
			employeeId: selectedEmployeeId,
			status: AssetStatus.ACTIVE,
		},
		{
			enabled: Boolean(selectedEmployeeId),
		},
	);
	const createEmployee = api.employee.create.useMutation({
		onSuccess: async () => {
			await utils.employee.list.invalidate();
			await utils.employee.listAssignable.invalidate();
		},
	});

	const [firstName, setFirstName] = useState("John");
	const [lastName, setLastName] = useState("Doe");
	const [employeeEmail, setEmployeeEmail] = useState("employee@example.com");
	const [errors, setErrors] = useState(EMPTY_SERVER_ERRORS);

	useEffect(() => {
		const people = employees.data?.items ?? [];
		if (!people.length) {
			setSelectedEmployeeId(undefined);
			return;
		}

		const stillExists = selectedEmployeeId
			? people.some((employee) => employee.id === selectedEmployeeId)
			: false;
		if (!stillExists) {
			setSelectedEmployeeId(people[0]?.id);
		}
	}, [employees.data?.items, selectedEmployeeId]);

	const selectedEmployee =
		(employees.data?.items ?? []).find(
			(employee) => employee.id === selectedEmployeeId,
		) ?? null;
	const formatStatus = (status: string) =>
		status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();

	return (
		<ManagerPage
			title="Employee Management"
			description="Create and view employees eligible for asset assignments"
		>
			<div className="grid gap-4 lg:grid-cols-[360px_1fr]">
				<Card className="h-fit">
					<CardHeader>
						<CardTitle>Create employee</CardTitle>
						<CardDescription>Add a new team member.</CardDescription>
					</CardHeader>
					<CardContent>
						<form
							className="grid gap-2"
							onSubmit={async (event) => {
								event.preventDefault();
								setErrors(EMPTY_SERVER_ERRORS);
								try {
									await createEmployee.mutateAsync({
										firstName,
										lastName,
										email: employeeEmail,
									});
									toast.success("Employee created");
								} catch (error) {
									const parsed = extractServerFormErrors(error);
									setErrors(parsed);
									toast.error(parsed.formError ?? "Failed to create employee");
								}
							}}
						>
							<Input
								value={firstName}
								onChange={(event) => setFirstName(event.target.value)}
								placeholder="First name"
								className={inputErrorClass(errors.fieldErrors.firstName)}
							/>
							{errors.fieldErrors.firstName ? (
								<p className="text-xs text-destructive">{errors.fieldErrors.firstName}</p>
							) : null}
							<Input
								value={lastName}
								onChange={(event) => setLastName(event.target.value)}
								placeholder="Last name"
								className={inputErrorClass(errors.fieldErrors.lastName)}
							/>
							{errors.fieldErrors.lastName ? (
								<p className="text-xs text-destructive">{errors.fieldErrors.lastName}</p>
							) : null}
							<Input
								type="email"
								value={employeeEmail}
								onChange={(event) => setEmployeeEmail(event.target.value)}
								placeholder="Email"
								className={inputErrorClass(errors.fieldErrors.email)}
							/>
							{errors.fieldErrors.email ? (
								<p className="text-xs text-destructive">{errors.fieldErrors.email}</p>
							) : null}
							{errors.formError ? (
								<p className="text-sm text-destructive">{errors.formError}</p>
							) : null}
							<Button disabled={createEmployee.isPending} type="submit">
								{createEmployee.isPending ? "Creating..." : "Add employee"}
							</Button>
						</form>
					</CardContent>
				</Card>

				<div className="grid gap-4">
					<Card>
						<CardHeader>
							<CardTitle>Employees</CardTitle>
							<CardDescription>
								Active employee directory and assignment pool.
							</CardDescription>
						</CardHeader>
						<CardContent>
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Name</TableHead>
										<TableHead>Email</TableHead>
										<TableHead>Status</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{(employees.data?.items ?? []).map((employee) => (
										<TableRow
											key={employee.id}
											data-state={
												employee.id === selectedEmployeeId ? "selected" : undefined
											}
											className="cursor-pointer"
											onClick={() => setSelectedEmployeeId(employee.id)}
										>
											<TableCell>
												{employee.firstName} {employee.lastName}
											</TableCell>
											<TableCell>{employee.email}</TableCell>
											<TableCell>{employee.isActive ? "Active" : "Inactive"}</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle>
								{selectedEmployee
									? `${selectedEmployee.firstName} ${selectedEmployee.lastName} assets`
									: "Employee assets"}
							</CardTitle>
							<CardDescription>
								Click an employee row above to inspect their active assigned assets.
							</CardDescription>
						</CardHeader>
						<CardContent>
							{!selectedEmployee ? (
								<p className="text-sm text-muted-foreground">No employee selected.</p>
							) : employeeAssets.isLoading ? (
								<p className="text-sm text-muted-foreground">Loading assets...</p>
							) : (
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>Asset</TableHead>
											<TableHead>Barcode</TableHead>
											<TableHead>Category</TableHead>
											<TableHead>Status</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{(employeeAssets.data?.items ?? []).map((asset) => (
											<TableRow key={asset.id}>
												<TableCell>{asset.name}</TableCell>
												<TableCell>{asset.barcode}</TableCell>
												<TableCell>{asset.category}</TableCell>
												<TableCell>{formatStatus(asset.status)}</TableCell>
											</TableRow>
										))}
										{(employeeAssets.data?.items.length ?? 0) === 0 ? (
											<TableRow>
												<TableCell colSpan={4} className="text-sm text-muted-foreground">
													No active assigned assets for this employee.
												</TableCell>
											</TableRow>
										) : null}
									</TableBody>
								</Table>
							)}
						</CardContent>
					</Card>
				</div>
			</div>
		</ManagerPage>
	);
}
