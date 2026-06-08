import dotenv from "dotenv";
import {
	isExaAvailable,
	searchCompetitorIntel,
	searchMarketIntel,
	searchRegulatoryChanges,
} from "./exa-search.js";

dotenv.config();

async function runTests() {
	console.log("--- Starting Exa Search Service Integration Tests ---");
	console.log("isExaAvailable():", isExaAvailable());

	if (!isExaAvailable()) {
		console.warn(
			"Skipping live tests because EXA_API_KEY is not set in environment.",
		);
		return;
	}

	try {
		// Test Market Intel
		console.log("\nTesting searchMarketIntel...");
		const marketRes = await searchMarketIntel("digital assets", "Gulf", "30d");
		console.log("Market Intel Trend:", marketRes.trend);
		console.log("Market Intel Signals Count:", marketRes.signals.length);
		if (marketRes.signals.length > 0) {
			console.log("First Signal Headline:", marketRes.signals[0].headline);
			console.log("First Signal Source URL:", marketRes.signals[0].sourceUrl);
		}

		// Test Competitor Intel
		console.log("\nTesting searchCompetitorIntel...");
		const competitorRes = await searchCompetitorIntel("DIFC", "regulatory");
		console.log("Competitor Threat Level:", competitorRes.threatLevel);
		console.log(
			"Competitor Strengths Count:",
			competitorRes.swot.strengths.length,
		);
		console.log(
			"Competitor Live Sources Count:",
			competitorRes.liveSources.length,
		);
		if (competitorRes.liveSources.length > 0) {
			console.log("First Live Source:", competitorRes.liveSources[0]);
		}

		// Test Regulatory Tracker
		console.log("\nTesting searchRegulatoryChanges...");
		const regulatoryRes = await searchRegulatoryChanges("EU", "digital_assets");
		console.log("Regulatory Changes Count:", regulatoryRes.changes.length);
		if (regulatoryRes.changes.length > 0) {
			console.log("First Change Title:", regulatoryRes.changes[0].title);
			console.log("First Change Status:", regulatoryRes.changes[0].status);
			console.log(
				"First Change Source URL:",
				regulatoryRes.changes[0].sourceUrl,
			);
		}

		console.log("\n--- All tests completed successfully ---");
	} catch (error) {
		console.error("Test execution failed:", error);
		process.exit(1);
	}
}

runTests();
