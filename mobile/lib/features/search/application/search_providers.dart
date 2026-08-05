import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../data/search_repository.dart';
import '../domain/search_result.dart';

/// Minimum query length before a search is fired. Below this, the UI shows
/// the "start typing" prompt and no request is made — mirrors the backend's
/// own "all-empty below 2 chars" behavior, just short-circuited client-side.
const int kSearchMinQueryLength = 2;

/// Raw, un-debounced text currently in the search field. Updated on every
/// keystroke so field-dependent UI (the clear button) reacts instantly.
final StateProvider<String> searchQueryProvider = StateProvider<String>((ref) => '');

/// Debounced copy of [searchQueryProvider], updated by the screen ~350ms
/// after typing pauses. [globalSearchProvider] is keyed on this value (not
/// the raw query) so the API isn't hit on every keystroke.
final StateProvider<String> debouncedSearchQueryProvider = StateProvider<String>((ref) => '');

/// Fires `GET /search?q=...` for a given (debounced, trimmed) query.
/// Callers should only watch this once the query is >= [kSearchMinQueryLength]
/// characters; shorter queries are handled entirely client-side.
final FutureProviderFamily<GlobalSearchResult, String> globalSearchProvider =
    FutureProvider.family<GlobalSearchResult, String>((ref, query) {
  return ref.watch(searchRepositoryProvider).search(query);
});
