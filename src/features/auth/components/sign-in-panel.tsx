import { signIn } from "next-auth/react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { EMPTY_SERVER_ERRORS, inputErrorClass } from "~/lib/form-errors";

export function SignInPanel() {
	const [email, setEmail] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [errors, setErrors] = useState(EMPTY_SERVER_ERRORS);

	return (
		<Card className="mx-auto max-w-md border-border/80 bg-card/90 shadow-xl backdrop-blur">
			<CardHeader>
				<CardTitle className="text-3xl leading-none">Sign in</CardTitle>
			</CardHeader>
			<CardContent className="space-y-4">
				<p className="text-sm text-muted-foreground">
					Use an existing user email. You can create users from the manager
					dashboard after bootstrap.
				</p>
				<form
					className="space-y-3"
					onSubmit={async (event) => {
						event.preventDefault();
						setSubmitting(true);
						setErrors(EMPTY_SERVER_ERRORS);
						const result = await signIn("credentials", {
							email,
							redirect: false,
						});
						if (result?.error) {
							setErrors({
								formError: "Sign in failed. Check the email and try again.",
								fieldErrors: {
									email: "Invalid or inactive account for this email.",
								},
							});
							toast.error("Sign in failed");
						}
						setSubmitting(false);
					}}
				>
					<Input
						type="email"
						value={email}
						onChange={(event) => setEmail(event.target.value)}
						placeholder="name@company.com"
						className={inputErrorClass(errors.fieldErrors.email)}
					/>
					{errors.fieldErrors.email ? (
						<p className="text-xs text-destructive">{errors.fieldErrors.email}</p>
					) : null}
					{errors.formError ? (
						<p className="text-sm text-destructive">{errors.formError}</p>
					) : null}
					<Button
						disabled={submitting}
						type="submit"
						className="w-full"
					>
						{submitting ? "Signing in..." : "Sign in"}
					</Button>
				</form>
			</CardContent>
		</Card>
	);
}
