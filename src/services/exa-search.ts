import Exa from "exa-js";

// biome-ignore lint/suspicious/noExplicitAny: lazy client instance
let exaInstance: any = null;
let isInitialized = false;

/**
 * Time one Exa SDK call and log it. Picked up by the existing Pino
 * logger in stdout (and in Railway's `railway logs` in production).
 * Used by every searchXxx() function so we can see per-call network
 * latency alongside the agent-level timing from latency-hooks.ts.
 */
async function timedExaCall<T>(
	label: string,
	query: string,
	fn: () => Promise<T>,
): Promise<T> {
	const t0 = Date.now();
	try {
		const out = await fn();
		const ms = Date.now() - t0;
		// Keep the log line greppable; trim the query to keep logs compact.
		const q = query.length > 120 ? `${query.slice(0, 117)}…` : query;
		console.log(
			`[latency] ⏱ exa-call label=${label} elapsed=${ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(2)}s`} query="${q}"`,
		);
		return out;
	} catch (err) {
		const ms = Date.now() - t0;
		console.log(
			`[latency] ⏱ exa-call label=${label} elapsed=${ms}ms status=error err=${err instanceof Error ? err.message : String(err)}`,
		);
		throw err;
	}
}

// biome-ignore lint/suspicious/noExplicitAny: return client instance
function getExaClient(): any {
	if (!isInitialized) {
		const apiKey = process.env.EXA_API_KEY;
		// @ts-ignore
		exaInstance = apiKey ? new Exa(apiKey) : null;
		isInitialized = true;
	}
	return exaInstance;
}

// Caching structure
interface CacheEntry<T> {
	data: T;
	timestamp: number;
}

// biome-ignore lint/suspicious/noExplicitAny: cache storage can hold any response shape
const cache = new Map<string, CacheEntry<any>>();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

function getFromCache<T>(key: string): T | null {
	const entry = cache.get(key);
	if (!entry) return null;
	const elapsed = Date.now() - entry.timestamp;
	if (elapsed > CACHE_TTL_MS) {
		cache.delete(key);
		return null;
	}
	return entry.data;
}

function setToCache<T>(key: string, data: T): void {
	cache.set(key, { data, timestamp: Date.now() });
}

export function isExaAvailable(): boolean {
	return !!getExaClient();
}

// Clean highlights for summary context
function cleanHighlight(text: string): string {
	if (!text) return "";
	return text
		.replace(/\[\.\.\.\]/g, "")
		.replace(/\s+/g, " ")
		.trim();
}

// Format a result list for the console log. Exa results are dynamic
// shapes (the SDK returns `any`), so we use `any` here too. The whole
// function is for debug output only — no production code reads it.
// biome-ignore lint/suspicious/noExplicitAny: debug log only
function formatResultList(results: any[]): string {
	return results
		.map(
			// biome-ignore lint/suspicious/noExplicitAny: raw API mapping
			(r: any, i: number) =>
				`    [${i + 1}] ${r.title ?? "(no title)"} — ${r.url ?? "(no url)"}${r.publishedDate ? ` (${r.publishedDate.substring(0, 10)})` : ""}`,
		)
		.join("\n");
}

// Helper to extract domain from URL
function getDomain(url: string): string {
	try {
		const parsed = new URL(url);
		return parsed.hostname.replace("www.", "");
	} catch {
		return "Web Source";
	}
}

// --- Market Intelligence Search ---

const MARKET_DOMAINS = [
	"bloomberg.com",
	"reuters.com",
	"ft.com",
	"wsj.com",
	"cnbc.com",
	"economist.com",
	"investing.com",
	"seekingalpha.com",
	"marketwatch.com",
	"finance.yahoo.com",
	"techcrunch.com",
	"khaleejtimes.com",
	"thenationalnews.com",
	"gulfnews.com",
	"dealstreetasia.com",
];

export async function searchMarketIntel(
	topic: string,
	region: string | null,
	timeframe: string,
) {
	const exa = getExaClient();
	if (!exa) {
		throw new Error("Exa API client is not initialized. Check EXA_API_KEY.");
	}

	const cacheKey = `market_${topic}_${region || "global"}_${timeframe}`;
	// biome-ignore lint/suspicious/noExplicitAny: cached data is type dynamic
	const cached = getFromCache<any>(cacheKey);
	if (cached) {
		console.log(
			`[exa] searchMarketIntel CACHE HIT  topic="${topic}" region="${region ?? "global"}" timeframe=${timeframe} → returning ${cached.signals?.length ?? 0} cached signals`,
		);
		return cached;
	}

	console.log("[exa] searchMarketIntel CACHE MISS → calling Exa API");

	// Build query
	const queryRegion = region ? ` in ${region}` : "";
	const query = `latest market trends, FDI flows, capital movements, and investor sentiment for ${topic}${queryRegion}`;

	// Timeframe handling
	let startPublishedDate: string | undefined = undefined;
	const now = new Date();
	if (timeframe === "24h") {
		now.setDate(now.getDate() - 1);
		startPublishedDate = now.toISOString();
	} else if (timeframe === "7d") {
		now.setDate(now.getDate() - 7);
		startPublishedDate = now.toISOString();
	} else if (timeframe === "30d") {
		now.setDate(now.getDate() - 30);
		startPublishedDate = now.toISOString();
	} else if (timeframe === "90d") {
		now.setDate(now.getDate() - 90);
		startPublishedDate = now.toISOString();
	} else if (timeframe === "ytd") {
		startPublishedDate = new Date(now.getFullYear(), 0, 1).toISOString();
	}

	// biome-ignore lint/suspicious/noExplicitAny: exa response is dynamic
	let response: any;
	try {
		console.log(
			`[exa] searchMarketIntel QUERY        query="${query}" domains=${MARKET_DOMAINS.length} startPublishedDate=${startPublishedDate ?? "none"} numResults=5`,
		);
		// First attempt with domain restrictions
		response = await timedExaCall("market.primary", query, () =>
			exa.searchAndContents(query, {
				numResults: 5,
				highlights: true,
				startPublishedDate,
				includeDomains: MARKET_DOMAINS,
			}),
		);

		// Fallback if no results found on specific domains
		if (!response.results || response.results.length === 0) {
			console.log(
				"[exa] searchMarketIntel DOMAIN FALLBACK → retrying without domain filter",
			);
			response = await timedExaCall("market.fallback", query, () =>
				exa.searchAndContents(query, {
					numResults: 5,
					highlights: true,
					startPublishedDate,
				}),
			);
		}
	} catch (error) {
		console.warn(
			"[exa] searchMarketIntel ERROR → falling back to unfiltered query:",
			error,
		);
		response = await timedExaCall("market.error-fallback", query, () =>
			exa.searchAndContents(query, {
				numResults: 5,
				highlights: true,
			}),
		);
	}

	const results = response.results || [];
	console.log(
		`[exa] searchMarketIntel RESULT       ${results.length} result(s) for "${query}"\n${formatResultList(results)}`,
	);
	// biome-ignore lint/suspicious/noExplicitAny: raw API mapping
	const signals = results.map((result: any) => {
		const firstHighlight = result.highlights?.[0]
			? cleanHighlight(result.highlights[0])
			: "";
		const detail = firstHighlight
			? firstHighlight.substring(0, 250) +
				(firstHighlight.length > 250 ? "..." : "")
			: "Live signal captured via Exa search.";

		// Simple keyword-based magnitude heuristics
		let magnitude: "high" | "medium" | "low" = "medium";
		const textToAnalyze = `${result.title} ${detail}`.toLowerCase();
		if (
			textToAnalyze.includes("billion") ||
			textToAnalyze.includes("critical") ||
			textToAnalyze.includes("surge") ||
			textToAnalyze.includes("major")
		) {
			magnitude = "high";
		} else if (
			textToAnalyze.includes("minor") ||
			textToAnalyze.includes("steady") ||
			textToAnalyze.includes("unchanged")
		) {
			magnitude = "low";
		}

		return {
			headline: result.title || "Market Signal",
			detail,
			magnitude,
			region: region || "Global",
			sourceUrl: result.url,
		};
	});

	// Infer trend
	let trend: "growing" | "stable" | "declining" = "stable";
	let sentimentScore = 0;
	const positiveWords = [
		"grow",
		"expand",
		"increase",
		"rebound",
		"rise",
		"accelerate",
		"boost",
		"inflow",
		"up",
		"surpass",
	];
	const negativeWords = [
		"decline",
		"fall",
		"decrease",
		"drop",
		"shrink",
		"down",
		"outflow",
		"trough",
		"slowing",
	];

	for (const sig of signals) {
		const text = `${sig.headline} ${sig.detail}`.toLowerCase();
		for (const w of positiveWords) {
			if (text.includes(w)) sentimentScore++;
		}
		for (const w of negativeWords) {
			if (text.includes(w)) sentimentScore--;
		}
	}

	if (sentimentScore > 1) trend = "growing";
	else if (sentimentScore < -1) trend = "declining";

	// biome-ignore lint/suspicious/noExplicitAny: map callback
	const sourceUrls = results.map((r: any) => r.url).filter(Boolean) as string[];
	// biome-ignore lint/suspicious/noExplicitAny: map callback
	const sources = results.map((r: any) => getDomain(r.url));

	const output = {
		signals,
		trend,
		sources: sources.length > 0 ? sources : ["Exa Live Web Search"],
		sourceUrls,
		isLive: true,
	};

	setToCache(cacheKey, output);
	return output;
}

// --- Competitor Intelligence Search ---

const COMPETITOR_DOMAINS = [
	"difc.ae",
	"adgm.com",
	"qfc.qa",
	"giftcity.in",
	"mas.gov.sg",
	"hkma.gov.hk",
	"centralbank.ie",
	"luxembourgforfinance.com",
	"reuters.com",
	"bloomberg.com",
	"ft.com",
];

export async function searchCompetitorIntel(
	financialCenter: string,
	dimension: string,
) {
	const exa = getExaClient();
	if (!exa) {
		throw new Error("Exa API client is not initialized.");
	}

	const cacheKey = `competitor_${financialCenter}_${dimension}`;
	// biome-ignore lint/suspicious/noExplicitAny: cache read
	const cached = getFromCache<any>(cacheKey);
	if (cached) {
		console.log(
			`[exa] searchCompetitorIntel CACHE HIT  center="${financialCenter}" dimension="${dimension}" → returning ${cached.liveSources?.length ?? 0} cached live sources`,
		);
		return cached;
	}

	console.log("[exa] searchCompetitorIntel CACHE MISS → calling Exa API");

	const query = `${financialCenter} financial centre SWOT analysis benchmarking strategic updates ${dimension} developments`;

	// biome-ignore lint/suspicious/noExplicitAny: exa response
	let response: any;
	try {
		console.log(
			`[exa] searchCompetitorIntel QUERY        query="${query}" domains=${COMPETITOR_DOMAINS.length} numResults=4`,
		);
		response = await timedExaCall("competitor.primary", query, () =>
			exa.searchAndContents(query, {
				numResults: 4,
				highlights: true,
				includeDomains: COMPETITOR_DOMAINS,
			}),
		);

		if (!response.results || response.results.length === 0) {
			console.log(
				"[exa] searchCompetitorIntel DOMAIN FALLBACK → retrying without domain filter",
			);
			response = await timedExaCall("competitor.fallback", query, () =>
				exa.searchAndContents(query, {
					numResults: 4,
					highlights: true,
				}),
			);
		}
	} catch (error) {
		console.warn(
			"[exa] searchCompetitorIntel ERROR → falling back to unfiltered query:",
			error,
		);
		response = await timedExaCall("competitor.error-fallback", query, () =>
			exa.searchAndContents(query, {
				numResults: 4,
				highlights: true,
			}),
		);
	}

	const results = response.results || [];
	console.log(
		`[exa] searchCompetitorIntel RESULT       ${results.length} result(s) for "${financialCenter} (${dimension})"\n${formatResultList(results)}`,
	);

	// Map search highlights to SWOT points
	const strengths: string[] = [];
	const weaknesses: string[] = [];
	const opportunities: string[] = [];
	const threats: string[] = [];

	for (const result of results) {
		const text = `${result.title} - ${result.highlights?.[0] ? cleanHighlight(result.highlights[0]) : ""}`;
		const cleanText = text.substring(0, 150) + (text.length > 150 ? "..." : "");
		const lowerText = text.toLowerCase();

		if (
			lowerText.includes("risk") ||
			lowerText.includes("challenge") ||
			lowerText.includes("cost") ||
			lowerText.includes("inflation") ||
			lowerText.includes("slowing") ||
			lowerText.includes("bottleneck") ||
			lowerText.includes("lagging")
		) {
			weaknesses.push(`Live: ${cleanText}`);
		} else if (
			lowerText.includes("partner") ||
			lowerText.includes("cooperate") ||
			lowerText.includes("sandbox") ||
			lowerText.includes("collaboration") ||
			lowerText.includes("joint") ||
			lowerText.includes("opportunity")
		) {
			opportunities.push(`Live: ${cleanText}`);
		} else if (
			lowerText.includes("poach") ||
			lowerText.includes("divert") ||
			lowerText.includes("compete") ||
			lowerText.includes("threaten") ||
			lowerText.includes("tax holiday") ||
			lowerText.includes("undercut") ||
			lowerText.includes("drain")
		) {
			threats.push(`Live: ${cleanText}`);
		} else {
			strengths.push(`Live: ${cleanText}`);
		}
	}

	// Infer threat level
	let threatLevel: "direct" | "indirect" | "none" = "indirect";
	const threatCount = threats.length;
	if (threatCount >= 2) {
		threatLevel = "direct";
	} else if (threatCount === 0) {
		threatLevel = "none";
	}

	// Dynamic response option from Exa results
	const responseOptions: string[] = [];
	if (results.length > 0) {
		responseOptions.push(
			`Formulate strategic counter-positioning regarding: "${results[0].title}"`,
		);
	}
	if (results.length > 1) {
		responseOptions.push(
			`Initiate bilateral collaboration or regulatory inquiry based on updates from: ${getDomain(results[1].url)}`,
		);
	}

	// biome-ignore lint/suspicious/noExplicitAny: map callback
	const liveSources = results.map((r: any) => ({
		title: r.title || "Live Update",
		url: r.url || "",
		date: r.publishedDate
			? r.publishedDate.substring(0, 10)
			: new Date().toISOString().substring(0, 10),
	}));

	const output = {
		swot: {
			strengths,
			weaknesses,
			opportunities,
			threats,
		},
		threatLevel,
		responseOptions,
		liveSources,
		isLive: true,
	};

	setToCache(cacheKey, output);
	return output;
}

// --- Regulatory Tracker Search ---

const REGULATORY_DOMAINS = [
	"sec.gov",
	"fca.org.uk",
	"esma.europa.eu",
	"dfsa.ae",
	"fsra.adgm.com",
	"mas.gov.sg",
	"ifsca.gov.in",
	"g20.org",
	"bis.org",
	"imf.org",
	"reuters.com",
	"bloomberg.com",
];

export async function searchRegulatoryChanges(
	jurisdiction: string,
	sector: string,
) {
	const exa = getExaClient();
	if (!exa) {
		throw new Error("Exa API client is not initialized.");
	}

	const cacheKey = `regulatory_${jurisdiction}_${sector}`;
	// biome-ignore lint/suspicious/noExplicitAny: cache read
	const cached = getFromCache<any>(cacheKey);
	if (cached) {
		console.log(
			`[exa] searchRegulatoryChanges CACHE HIT  jurisdiction="${jurisdiction}" sector="${sector}" → returning ${cached.changes?.length ?? 0} cached changes`,
		);
		return cached;
	}

	console.log("[exa] searchRegulatoryChanges CACHE MISS → calling Exa API");

	const query = `${jurisdiction} regulatory policy legislative compliance changes updates guidelines ${sector}`;

	// biome-ignore lint/suspicious/noExplicitAny: exa response
	let response: any;
	try {
		console.log(
			`[exa] searchRegulatoryChanges QUERY        query="${query}" domains=${REGULATORY_DOMAINS.length} numResults=5`,
		);
		response = await timedExaCall("regulatory.primary", query, () =>
			exa.searchAndContents(query, {
				numResults: 5,
				highlights: true,
				includeDomains: REGULATORY_DOMAINS,
			}),
		);

		if (!response.results || response.results.length === 0) {
			console.log(
				"[exa] searchRegulatoryChanges DOMAIN FALLBACK → retrying without domain filter",
			);
			response = await timedExaCall("regulatory.fallback", query, () =>
				exa.searchAndContents(query, {
					numResults: 5,
					highlights: true,
				}),
			);
		}
	} catch (error) {
		console.warn(
			"[exa] searchRegulatoryChanges ERROR → falling back to unfiltered query:",
			error,
		);
		response = await timedExaCall("regulatory.error-fallback", query, () =>
			exa.searchAndContents(query, {
				numResults: 5,
				highlights: true,
			}),
		);
	}

	const results = response.results || [];
	console.log(
		`[exa] searchRegulatoryChanges RESULT       ${results.length} result(s) for "${jurisdiction} (${sector})"\n${formatResultList(results)}`,
	);
	// biome-ignore lint/suspicious/noExplicitAny: map callback
	const changes = results.map((result: any) => {
		const highlight = result.highlights?.[0]
			? cleanHighlight(result.highlights[0])
			: "";
		const summary = highlight
			? highlight.substring(0, 200) + (highlight.length > 200 ? "..." : "")
			: "Live regulatory update found via Exa.";

		// Status parsing
		let status: "proposed" | "under_review" | "enacted" | "amended" =
			"under_review";
		const titleLower = (result.title || "").toLowerCase();
		const summaryLower = summary.toLowerCase();
		if (titleLower.includes("propose") || summaryLower.includes("propose")) {
			status = "proposed";
		} else if (
			titleLower.includes("enact") ||
			summaryLower.includes("enact") ||
			titleLower.includes("implement") ||
			titleLower.includes("finalis") ||
			titleLower.includes("finaliz")
		) {
			status = "enacted";
		} else if (titleLower.includes("amend") || summaryLower.includes("amend")) {
			status = "amended";
		}

		// Severity parsing
		let severity: "high" | "medium" | "low" = "medium";
		if (
			summaryLower.includes("major") ||
			summaryLower.includes("critical") ||
			summaryLower.includes("penalty") ||
			summaryLower.includes("mandatory")
		) {
			severity = "high";
		} else if (
			summaryLower.includes("minor") ||
			summaryLower.includes("clarification") ||
			summaryLower.includes("optional")
		) {
			severity = "low";
		}

		// Jurisdiction inference
		let inferredJurisdiction = jurisdiction;
		if (jurisdiction.toLowerCase() === "global") {
			if (
				titleLower.includes("dfsa") ||
				titleLower.includes("dubai") ||
				titleLower.includes("difc")
			) {
				inferredJurisdiction = "UAE (DIFC)";
			} else if (titleLower.includes("adgm") || titleLower.includes("fsra")) {
				inferredJurisdiction = "UAE (ADGM)";
			} else if (
				titleLower.includes("eu") ||
				titleLower.includes("esma") ||
				titleLower.includes("mica")
			) {
				inferredJurisdiction = "EU";
			} else if (
				titleLower.includes("mas") ||
				titleLower.includes("singapore")
			) {
				inferredJurisdiction = "Singapore";
			} else if (titleLower.includes("sec") || titleLower.includes("us ")) {
				inferredJurisdiction = "USA";
			}
		}

		return {
			title: result.title || "Regulatory update",
			jurisdiction: inferredJurisdiction,
			sector: sector === "all" ? "general" : sector,
			status,
			severity,
			effectiveDate: result.publishedDate
				? result.publishedDate.substring(0, 10)
				: null,
			summary,
			impact: `Monitored live regulatory shift. Potential compliance alignment required for entities operating across ${inferredJurisdiction}.`,
			actionRequired: `Evaluate operational impact of this policy shift. Monitor formal channels at ${getDomain(result.url)}.`,
			source: getDomain(result.url),
			isLive: true,
			sourceUrl: result.url,
		};
	});

	const output = {
		changes,
		count: changes.length,
		isLive: true,
	};

	setToCache(cacheKey, output);
	return output;
}
