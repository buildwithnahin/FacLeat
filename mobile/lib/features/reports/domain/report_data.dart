import 'package:equatable/equatable.dart';

/// A single renderable table extracted from a report payload.
///
/// Report endpoints return wildly different JSON shapes (HR reports ship a
/// `{columns, rows}` pair; general/financial reports ship bespoke nested
/// objects). Rather than hand-writing a bespoke widget per report type, every
/// payload is normalized into a list of [ReportSection]s by [parseReportPayload]
/// and rendered by one generic table widget.
class ReportSection extends Equatable {
  const ReportSection({
    required this.title,
    required this.columns,
    required this.rows,
  });

  final String title;
  final List<String> columns;

  /// Each row is a list of pre-stringified cell values, positionally aligned
  /// with [columns].
  final List<List<String>> rows;

  bool get isEmpty => rows.isEmpty;

  @override
  List<Object?> get props => [title, columns, rows];
}

String humanizeKey(String key) {
  final withSpaces = key
      .replaceAllMapped(RegExp(r'([a-z0-9])([A-Z])'), (m) => '${m[1]} ${m[2]}')
      .replaceAll('_', ' ')
      .replaceAll('-', ' ');
  final words = withSpaces.split(' ').where((w) => w.isNotEmpty);
  return words.map((w) => w[0].toUpperCase() + w.substring(1)).join(' ');
}

String _stringify(dynamic value) {
  if (value == null) return '—';
  if (value is String) return value.isEmpty ? '—' : value;
  if (value is num) return value.toString();
  if (value is bool) return value ? 'Yes' : 'No';
  return value.toString();
}

/// Keys commonly present alongside HR report payloads that hold filter /
/// dropdown metadata rather than reportable data — excluded from the
/// generic flatten pass so the summary table stays meaningful.
const _noiseKeys = {'filters', 'options', 'meta'};

/// Normalizes any report JSON payload into one or more [ReportSection]s.
///
/// Handles, in priority order:
///  1. HR shape: `{report: {title, columns: [...], rows: [[...], ...]}}`
///     (rows are positional lists, not maps).
///  2. A bare top-level `{columns: [...], rows: [...]}` map.
///  3. A bare top-level list of maps (e.g. `top-products`, `trial-balance`).
///  4. General/financial shape: an arbitrary map. Every `List<Map>` valued
///     field becomes its own titled section (e.g. `channels`, `rows`,
///     `byDepartment`). Every remaining scalar / nested-map field is
///     flattened into a single "Summary" key/value section.
List<ReportSection> parseReportPayload(dynamic raw) {
  if (raw == null) return const [];

  // Case 3: bare list.
  if (raw is List) {
    return _sectionsFromList('Report', raw);
  }

  if (raw is! Map) return const [];
  final map = Map<String, dynamic>.from(raw);

  // Case 1: HR nested report shape.
  final reportBlock = map['report'];
  if (reportBlock is Map && reportBlock['columns'] is List && reportBlock['rows'] is List) {
    final title = reportBlock['title']?.toString() ?? 'Report';
    final columns = (reportBlock['columns'] as List).map((c) => c.toString()).toList();
    final rawRows = reportBlock['rows'] as List;
    final rows = rawRows.map<List<String>>((r) {
      if (r is List) return r.map(_stringify).toList();
      return [_stringify(r)];
    }).toList();
    final sections = <ReportSection>[ReportSection(title: title, columns: columns, rows: rows)];

    final dashboard = map['dashboard'];
    if (dashboard is Map && dashboard.isNotEmpty) {
      sections.insert(0, _summarySection('Overview', Map<String, dynamic>.from(dashboard)));
    }
    return sections;
  }

  // Case 2: bare top-level columns/rows.
  if (map['columns'] is List && map['rows'] is List) {
    final columns = (map['columns'] as List).map((c) => c.toString()).toList();
    final rawRows = map['rows'] as List;
    final rows = rawRows.map<List<String>>((r) {
      if (r is List) return r.map(_stringify).toList();
      if (r is Map) return columns.map((c) => _stringify(r[c])).toList();
      return [_stringify(r)];
    }).toList();
    return [ReportSection(title: 'Report', columns: columns, rows: rows)];
  }

  // Case 4: arbitrary nested map — pull out every list-of-maps as its own
  // section, flatten the rest into a summary.
  final sections = <ReportSection>[];
  final summary = <String, dynamic>{};

  map.forEach((key, value) {
    if (_noiseKeys.contains(key)) return;
    if (value is List && value.isNotEmpty && value.every((e) => e is Map)) {
      final listSections = _sectionsFromList(humanizeKey(key), value);
      sections.addAll(listSections);
    } else if (value is List && value.isEmpty) {
      // Skip empty lists — nothing to show, avoid noisy empty sections.
    } else if (value is Map) {
      _flattenInto(summary, key, Map<String, dynamic>.from(value));
    } else {
      summary[key] = value;
    }
  });

  if (summary.isNotEmpty) {
    sections.add(_summarySection('Summary', summary));
  }

  return sections;
}

void _flattenInto(Map<String, dynamic> target, String prefix, Map<String, dynamic> source) {
  source.forEach((key, value) {
    final flatKey = '$prefix.$key';
    if (value is Map) {
      _flattenInto(target, flatKey, Map<String, dynamic>.from(value));
    } else if (value is List) {
      if (value.isNotEmpty) target[flatKey] = value.join(', ');
    } else {
      target[flatKey] = value;
    }
  });
}

ReportSection _summarySection(String title, Map<String, dynamic> data) {
  final rows = data.entries.map((e) => [humanizeKey(e.key), _stringify(e.value)]).toList();
  return ReportSection(title: title, columns: const ['Field', 'Value'], rows: rows);
}

List<ReportSection> _sectionsFromList(String title, List<dynamic> list) {
  if (list.isEmpty) return [ReportSection(title: title, columns: const [], rows: const [])];

  if (list.first is Map) {
    final columnSet = <String>{};
    for (final item in list) {
      if (item is Map) columnSet.addAll(item.keys.map((k) => k.toString()));
    }
    final columns = columnSet.toList();
    final rows = list.map<List<String>>((item) {
      final m = Map<String, dynamic>.from(item as Map);
      return columns.map((c) => _stringify(m[c])).toList();
    }).toList();
    return [
      ReportSection(
        title: title,
        columns: columns.map(humanizeKey).toList(),
        rows: rows,
      ),
    ];
  }

  return [
    ReportSection(
      title: title,
      columns: const ['Value'],
      rows: list.map((e) => [_stringify(e)]).toList(),
    ),
  ];
}

/// Picks the best section to chart: the first non-summary table that has at
/// least one numeric column. Returns `null` if nothing chartable is found.
class ChartableColumn {
  const ChartableColumn({required this.labelIndex, required this.valueIndex});
  final int labelIndex;
  final int valueIndex;
}

/// Picks which column to use as the chart/insight label, preferring a
/// human-readable "name"-like column over an id/code column so charts don't
/// end up labelled with raw cuids (e.g. prefer "Name" over "Product Id").
int _bestLabelIndex(List<String> columns, int numericIndex) {
  final candidates = [for (var i = 0; i < columns.length; i++) if (i != numericIndex) i];
  if (candidates.isEmpty) return numericIndex == 0 ? 1 : 0;

  for (final i in candidates) {
    if (columns[i].toLowerCase().contains('name')) return i;
  }
  for (final i in candidates) {
    final lower = columns[i].toLowerCase();
    if (!lower.contains('id') && !lower.contains('code')) return i;
  }
  return candidates.first;
}

/// Column-name keywords that indicate a genuine metric worth charting, in
/// priority order — checked before falling back to "first numeric column",
/// since numeric-looking id/code columns (e.g. account "Code": 1110) would
/// otherwise win just by being first.
const _metricKeywords = [
  'balance', 'total', 'amount', 'qty', 'quantity', 'revenue', 'value', 'sum', 'price', 'average',
];

({ReportSection section, ChartableColumn columns})? findChartableSection(List<ReportSection> sections) {
  for (final section in sections) {
    if (section.title == 'Summary' || section.title == 'Overview') continue;
    if (section.rows.isEmpty || section.columns.length < 2) continue;

    final numericIndexes = <int>[];
    for (var i = 0; i < section.columns.length; i++) {
      final looksNumeric = section.rows.every((row) {
        if (i >= row.length) return false;
        return double.tryParse(row[i].replaceAll(',', '')) != null;
      });
      if (looksNumeric) numericIndexes.add(i);
    }
    if (numericIndexes.isEmpty) continue;

    final numericIndex = _bestNumericIndex(section.columns, numericIndexes);
    final labelIndex = _bestLabelIndex(section.columns, numericIndex);
    if (labelIndex >= section.columns.length) continue;

    return (section: section, columns: ChartableColumn(labelIndex: labelIndex, valueIndex: numericIndex));
  }
  return null;
}

/// Among numeric-looking columns, prefers one whose name reads like a real
/// metric (balance/total/amount/...) over one that reads like an id/code —
/// falling back to the first non-id/code numeric column, then the first
/// numeric column of any kind.
int _bestNumericIndex(List<String> columns, List<int> numericIndexes) {
  for (final keyword in _metricKeywords) {
    for (final i in numericIndexes) {
      if (columns[i].toLowerCase().contains(keyword)) return i;
    }
  }
  for (final i in numericIndexes) {
    final lower = columns[i].toLowerCase();
    if (!lower.contains('id') && !lower.contains('code')) return i;
  }
  return numericIndexes.first;
}
