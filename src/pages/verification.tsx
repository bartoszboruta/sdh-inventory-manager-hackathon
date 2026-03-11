import Head from "next/head";

import { VerificationPage } from "~/features/verification/verification-page";

export default function VerificationRoute() {
	return (
		<>
			<Head>
				<title>Verification | SDH Inventory</title>
			</Head>
			<VerificationPage />
		</>
	);
}
