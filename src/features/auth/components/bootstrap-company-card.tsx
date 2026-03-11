import { useState } from "react";
import { toast } from "sonner";

import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import {
	EMPTY_SERVER_ERRORS,
	extractServerFormErrors,
	inputErrorClass,
} from "~/lib/form-errors";
import { api } from "~/utils/api";

export function BootstrapCompanyCard() {
	const utils = api.useUtils();
	const [companyName, setCompanyName] = useState("SDH Inventory Demo");
	const [errors, setErrors] = useState(EMPTY_SERVER_ERRORS);
	const boot = api.auth.bootstrapManager.useMutation({
		onSuccess: async () => {
			await utils.auth.me.invalidate();
			await utils.dashboard.overview.invalidate();
			toast.success("Company created");
		},
	});

	return (
		<div className="mx-auto max-w-xl">
			<Card>
				<CardHeader>
					<CardTitle>Setup company</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					<p className="text-sm text-muted-foreground">
						Your account is not yet assigned to a company. Bootstrap company and
						manager role.
					</p>
					<form
						className="flex flex-col gap-2 sm:flex-row"
						onSubmit={async (event) => {
							event.preventDefault();
							setErrors(EMPTY_SERVER_ERRORS);
							try {
								await boot.mutateAsync({ companyName });
							} catch (error) {
								const parsed = extractServerFormErrors(error);
								setErrors(parsed);
								toast.error(parsed.formError ?? "Failed to setup company");
							}
						}}
					>
						<Input
							value={companyName}
							onChange={(event) => setCompanyName(event.target.value)}
							placeholder="Company name"
							className={inputErrorClass(errors.fieldErrors.companyName)}
						/>
						{errors.fieldErrors.companyName ? (
							<p className="text-xs text-destructive">{errors.fieldErrors.companyName}</p>
						) : null}
						{errors.formError ? (
							<p className="text-sm text-destructive">{errors.formError}</p>
						) : null}
						<Button disabled={boot.isPending} type="submit">
							{boot.isPending ? "Creating..." : "Create"}
						</Button>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}
