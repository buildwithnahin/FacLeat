import 'package:equatable/equatable.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import '../domain/audit_entry.dart';

const int auditPageSize = 20;

class AuditFilter extends Equatable {
  const AuditFilter({this.module, this.branchId, this.search, this.from, this.to});

  final String? module;
  final String? branchId;
  final String? search;
  final DateTime? from;
  final DateTime? to;

  AuditFilter copyWith({
    String? module,
    bool clearModule = false,
    String? branchId,
    bool clearBranch = false,
    String? search,
    bool clearSearch = false,
    DateTime? from,
    DateTime? to,
    bool clearRange = false,
  }) {
    return AuditFilter(
      module: clearModule ? null : (module ?? this.module),
      branchId: clearBranch ? null : (branchId ?? this.branchId),
      search: clearSearch ? null : (search ?? this.search),
      from: clearRange ? null : (from ?? this.from),
      to: clearRange ? null : (to ?? this.to),
    );
  }

  @override
  List<Object?> get props => [module, branchId, search, from, to];
}

enum AuditListStatus { initial, loading, loadingMore, success, error }

class AuditListState extends Equatable {
  const AuditListState({
    this.entries = const [],
    this.total = 0,
    this.status = AuditListStatus.initial,
    this.errorMessage,
    this.filter = const AuditFilter(),
  });

  final List<AuditEntry> entries;
  final int total;
  final AuditListStatus status;
  final String? errorMessage;
  final AuditFilter filter;

  bool get hasMore => entries.length < total;

  AuditListState copyWith({
    List<AuditEntry>? entries,
    int? total,
    AuditListStatus? status,
    String? errorMessage,
    bool clearError = false,
    AuditFilter? filter,
  }) {
    return AuditListState(
      entries: entries ?? this.entries,
      total: total ?? this.total,
      status: status ?? this.status,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
      filter: filter ?? this.filter,
    );
  }

  @override
  List<Object?> get props => [entries, total, status, errorMessage, filter];
}

/// Paginated audit-log feed. The presentation layer kicks off the initial
/// load explicitly (from `initState`) rather than this class doing async
/// work inside `build()`, keeping `build()` a pure state constructor.
class AuditListNotifier extends Notifier<AuditListState> {
  @override
  AuditListState build() => const AuditListState();

  Map<String, dynamic> _query({required int limit, required int offset}) {
    final filter = state.filter;
    return {
      'limit': limit,
      'offset': offset,
      if (filter.module != null) 'module': filter.module,
      if (filter.branchId != null) 'branchId': filter.branchId,
      if (filter.search != null && filter.search!.isNotEmpty) 'search': filter.search,
      if (filter.from != null) 'from': formatIsoDateAudit(filter.from!),
      if (filter.to != null) 'to': formatIsoDateAudit(filter.to!),
    };
  }

  Future<void> loadFirstPage() async {
    state = state.copyWith(status: AuditListStatus.loading, clearError: true);
    try {
      final dio = ref.read(apiClientProvider);
      final response = await dio.get<Map<String, dynamic>>(
        '/audit',
        queryParameters: _query(limit: auditPageSize, offset: 0),
      );
      final data = response.data!['data'] as Map<String, dynamic>;
      final rows = (data['rows'] as List<dynamic>)
          .map((e) => AuditEntry.fromJson(Map<String, dynamic>.from(e as Map)))
          .toList();
      state = state.copyWith(
        entries: rows,
        total: (data['total'] as num?)?.toInt() ?? rows.length,
        status: AuditListStatus.success,
      );
    } catch (e) {
      state = state.copyWith(status: AuditListStatus.error, errorMessage: e.toString());
    }
  }

  Future<void> loadMore() async {
    if (state.status == AuditListStatus.loadingMore || !state.hasMore) return;
    state = state.copyWith(status: AuditListStatus.loadingMore);
    try {
      final dio = ref.read(apiClientProvider);
      final response = await dio.get<Map<String, dynamic>>(
        '/audit',
        queryParameters: _query(limit: auditPageSize, offset: state.entries.length),
      );
      final data = response.data!['data'] as Map<String, dynamic>;
      final rows = (data['rows'] as List<dynamic>)
          .map((e) => AuditEntry.fromJson(Map<String, dynamic>.from(e as Map)))
          .toList();
      state = state.copyWith(
        entries: [...state.entries, ...rows],
        total: (data['total'] as num?)?.toInt() ?? state.total,
        status: AuditListStatus.success,
      );
    } catch (e) {
      state = state.copyWith(status: AuditListStatus.error, errorMessage: e.toString());
    }
  }

  Future<void> applyFilter(AuditFilter filter) async {
    state = state.copyWith(filter: filter);
    await loadFirstPage();
  }
}

String formatIsoDateAudit(DateTime date) {
  final y = date.year.toString().padLeft(4, '0');
  final m = date.month.toString().padLeft(2, '0');
  final d = date.day.toString().padLeft(2, '0');
  return '$y-$m-$d';
}

final NotifierProvider<AuditListNotifier, AuditListState> auditListProvider =
    NotifierProvider<AuditListNotifier, AuditListState>(AuditListNotifier.new);

final FutureProvider<List<String>> auditModulesProvider = FutureProvider<List<String>>((ref) async {
  final dio = ref.watch(apiClientProvider);
  final response = await dio.get<Map<String, dynamic>>('/audit/modules');
  final data = response.data!['data'] as List<dynamic>;
  return data.map((e) => e.toString()).toList();
});

final auditDetailProvider = FutureProvider.family<AuditEntry, String>((ref, id) async {
  final dio = ref.watch(apiClientProvider);
  final response = await dio.get<Map<String, dynamic>>('/audit/$id');
  final data = response.data!['data'] as Map<String, dynamic>;
  return AuditEntry.fromJson(data);
});
