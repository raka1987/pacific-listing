/** The country someone last searched in, so the homepage search starts there next time. "all" means All Pacific. */
export const SEARCH_COUNTRY_COOKIE = "pl_search_country";

/** Saves the country chosen in a search box (in the browser; used on the next visit too). */
export function rememberSearchCountry(code: string) {
  document.cookie = `${SEARCH_COUNTRY_COOKIE}=${code || "all"}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
}
