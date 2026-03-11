import Head from "next/head";

import { EmployeesPage } from "~/features/employees/employees-page";

export default function EmployeesRoute() {
	return (
		<>
			<Head>
				<title>Employees | SDH Inventory</title>
			</Head>
			<EmployeesPage />
		</>
	);
}
