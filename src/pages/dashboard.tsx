import Head from "next/head";

import { DashboardPage } from "~/features/dashboard/dashboard-page";

export default function DashboardRoute() {
	return (
		<>
			<Head>
				<title>Dashboard | SDH Inventory</title>
			</Head>
			<DashboardPage />
		</>
	);
}
