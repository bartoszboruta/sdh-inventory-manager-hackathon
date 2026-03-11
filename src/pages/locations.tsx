import Head from "next/head";

import { LocationsPage } from "~/features/locations/locations-page";

export default function LocationsRoute() {
	return (
		<>
			<Head>
				<title>Locations | SDH Inventory</title>
			</Head>
			<LocationsPage />
		</>
	);
}
