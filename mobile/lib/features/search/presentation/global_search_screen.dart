import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:shimmer/shimmer.dart';

import '../../../core/theme/app_colors.dart';
import '../application/search_providers.dart';
import '../domain/search_result.dart';

/// Debounce delay between the last keystroke and firing the search request.
const Duration _kSearchDebounce = Duration(milliseconds: 350);

/// Generic status color, matching the app-wide convention (see CLAUDE.md
/// §10): green = healthy/posted/approved, amber = pending/draft/partial,
/// red = rejected/cancelled/overdue. Used for the status badge on sale and
/// purchase result cards, whose exact status enums aren't known client-side.
Color _statusColor(String status) {
  final s = status.toUpperCase();
  if (s.contains('CANCEL') || s.contains('REJECT') || s.contains('OVERDUE')) {
    return AppColors.danger;
  }
  if (s.contains('PENDING') || s.contains('DRAFT') || s.contains('PARTIAL') || s.contains('HOLD')) {
    return AppColors.warning;
  }
  return AppColors.success;
}

String _statusLabel(String status) {
  if (status.isEmpty) return status;
  return status[0] + status.substring(1).toLowerCase().replaceAll('_', ' ');
}

/// Full-text search across customers, suppliers, products, sales, and
/// purchases — pushed from the global search entry point (e.g. an app bar
/// action or the drawer), not part of the bottom-tab shell.
///
/// The search field lives in the app bar itself and autofocuses on open, so
/// opening this screen feels like "jump straight into typing".
class GlobalSearchScreen extends ConsumerStatefulWidget {
  const GlobalSearchScreen({super.key});

  @override
  ConsumerState<GlobalSearchScreen> createState() => _GlobalSearchScreenState();
}

class _GlobalSearchScreenState extends ConsumerState<GlobalSearchScreen> {
  final _controller = TextEditingController();
  Timer? _debounceTimer;

  @override
  void dispose() {
    _debounceTimer?.cancel();
    _controller.dispose();
    super.dispose();
  }

  void _onChanged(String value) {
    ref.read(searchQueryProvider.notifier).state = value;

    _debounceTimer?.cancel();
    _debounceTimer = Timer(_kSearchDebounce, () {
      if (!mounted) return;
      ref.read(debouncedSearchQueryProvider.notifier).state = value.trim();
    });
  }

  void _clear() {
    _debounceTimer?.cancel();
    _controller.clear();
    ref.read(searchQueryProvider.notifier).state = '';
    ref.read(debouncedSearchQueryProvider.notifier).state = '';
  }

  @override
  Widget build(BuildContext context) {
    final rawQuery = ref.watch(searchQueryProvider);
    final debouncedQuery = ref.watch(debouncedSearchQueryProvider);

    return Scaffold(
      appBar: AppBar(
        titleSpacing: 0,
        title: TextField(
          key: const Key('globalSearchField'),
          controller: _controller,
          autofocus: true,
          textInputAction: TextInputAction.search,
          onChanged: _onChanged,
          decoration: InputDecoration(
            hintText: 'Search customers, suppliers, products…',
            border: InputBorder.none,
            suffixIcon: rawQuery.isEmpty
                ? null
                : IconButton(
                    key: const Key('globalSearchClearButton'),
                    icon: const Icon(Icons.clear),
                    onPressed: _clear,
                  ),
          ),
        ),
      ),
      body: debouncedQuery.trim().length < kSearchMinQueryLength
          ? const _SearchPromptState()
          : _SearchResultsBody(query: debouncedQuery.trim()),
    );
  }
}

class _SearchResultsBody extends ConsumerWidget {
  const _SearchResultsBody({required this.query});

  final String query;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final resultAsync = ref.watch(globalSearchProvider(query));

    return resultAsync.when(
      loading: () => const _SearchResultsShimmer(),
      error: (error, stackTrace) => _SearchResultsError(
        onRetry: () => ref.invalidate(globalSearchProvider(query)),
      ),
      data: (result) {
        if (result.isEmpty) {
          return _EmptySearchState(query: query);
        }

        final sections = <Widget>[];
        var sectionIndex = 0;

        void addSection<T>({
          required String label,
          required IconData icon,
          required Color color,
          required List<T> items,
          required Widget Function(T item) cardBuilder,
        }) {
          if (items.isEmpty) return;
          final delay = (sectionIndex * 60).ms;
          sectionIndex++;
          sections.add(
            _ResultSection(
              label: label,
              icon: icon,
              color: color,
              count: items.length,
              children: items.map(cardBuilder).toList(),
            )
                .animate(delay: delay)
                .fadeIn(duration: 280.ms, curve: Curves.easeOut)
                .slideY(begin: 0.08, end: 0, duration: 280.ms, curve: Curves.easeOut),
          );
        }

        addSection<SearchCustomer>(
          label: 'Customers',
          icon: Icons.person_outline,
          color: AppColors.primary,
          items: result.customers,
          cardBuilder: (c) => _CustomerCard(customer: c),
        );
        addSection<SearchSupplier>(
          label: 'Suppliers',
          icon: Icons.local_shipping_outlined,
          color: AppColors.warning,
          items: result.suppliers,
          cardBuilder: (s) => _SupplierCard(supplier: s),
        );
        addSection<SearchProduct>(
          label: 'Products',
          icon: Icons.inventory_2_outlined,
          color: AppColors.success,
          items: result.products,
          cardBuilder: (p) => _ProductCard(product: p),
        );
        addSection<SearchSale>(
          label: 'Sales',
          icon: Icons.receipt_long_outlined,
          color: AppColors.primary,
          items: result.sales,
          cardBuilder: (s) => _SaleCard(sale: s),
        );
        addSection<SearchPurchase>(
          label: 'Purchases',
          icon: Icons.shopping_cart_outlined,
          color: AppColors.warning,
          items: result.purchases,
          cardBuilder: (p) => _PurchaseCard(purchase: p),
        );

        return ListView(
          key: const Key('globalSearchResultsList'),
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
          children: sections,
        );
      },
    );
  }
}

class _ResultSection extends StatelessWidget {
  const _ResultSection({
    required this.label,
    required this.icon,
    required this.color,
    required this.count,
    required this.children,
  });

  final String label;
  final IconData icon;
  final Color color;
  final int count;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 16, color: color),
              const SizedBox(width: 6),
              Text(
                label,
                style: theme.textTheme.labelLarge?.copyWith(
                  fontWeight: FontWeight.w700,
                  color: color,
                  letterSpacing: 0.3,
                ),
              ),
              const SizedBox(width: 6),
              Text(
                '($count)',
                style: theme.textTheme.labelSmall?.copyWith(color: theme.colorScheme.onSurfaceVariant),
              ),
            ],
          ),
          const SizedBox(height: 6),
          ...children,
        ],
      ),
    );
  }
}

/// Shared shell for every result card: colored leading icon, title/subtitle
/// column, optional trailing badge, chevron, tap handler.
class _ResultCard extends StatelessWidget {
  const _ResultCard({
    required this.icon,
    required this.color,
    required this.title,
    required this.subtitle,
    required this.onTap,
    this.trailingBadge,
    this.cardKey,
  });

  final IconData icon;
  final Color color;
  final String title;
  final String subtitle;
  final VoidCallback onTap;
  final Widget? trailingBadge;
  final Key? cardKey;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return Card(
      key: cardKey,
      margin: const EdgeInsets.only(bottom: 8),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            children: [
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(11),
                ),
                child: Icon(icon, color: color, size: 20),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Flexible(
                          child: Text(
                            title,
                            style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        if (trailingBadge != null) ...[
                          const SizedBox(width: 6),
                          trailingBadge!,
                        ],
                      ],
                    ),
                    const SizedBox(height: 3),
                    Text(
                      subtitle,
                      style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
              Icon(Icons.chevron_right, color: theme.colorScheme.onSurfaceVariant),
            ],
          ),
        ),
      ),
    );
  }
}

class _StatusBadge extends StatelessWidget {
  const _StatusBadge({required this.status});

  final String status;

  @override
  Widget build(BuildContext context) {
    final color = _statusColor(status);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        _statusLabel(status),
        style: TextStyle(color: color, fontWeight: FontWeight.w700, fontSize: 10, letterSpacing: 0.2),
      ),
    );
  }
}

class _CustomerCard extends StatelessWidget {
  const _CustomerCard({required this.customer});

  final SearchCustomer customer;

  @override
  Widget build(BuildContext context) {
    return _ResultCard(
      cardKey: Key('searchCustomerCard_${customer.id}'),
      icon: Icons.person_outline,
      color: AppColors.primary,
      title: customer.name,
      subtitle: [customer.code, if (customer.phone != null) customer.phone!].join(' · '),
      onTap: () => _showDetailSheet(
        context,
        title: customer.name,
        icon: Icons.person_outline,
        color: AppColors.primary,
        rows: [
          ('Name', customer.name),
          ('Code', customer.code),
          ('Phone', customer.phone ?? '—'),
          ('Email', customer.email ?? '—'),
        ],
      ),
    );
  }
}

class _SupplierCard extends StatelessWidget {
  const _SupplierCard({required this.supplier});

  final SearchSupplier supplier;

  @override
  Widget build(BuildContext context) {
    return _ResultCard(
      cardKey: Key('searchSupplierCard_${supplier.id}'),
      icon: Icons.local_shipping_outlined,
      color: AppColors.warning,
      title: supplier.name,
      subtitle: [supplier.code, if (supplier.phone != null) supplier.phone!].join(' · '),
      onTap: () => _showDetailSheet(
        context,
        title: supplier.name,
        icon: Icons.local_shipping_outlined,
        color: AppColors.warning,
        rows: [
          ('Name', supplier.name),
          ('Code', supplier.code),
          ('Phone', supplier.phone ?? '—'),
          ('Email', supplier.email ?? '—'),
        ],
      ),
    );
  }
}

class _ProductCard extends StatelessWidget {
  const _ProductCard({required this.product});

  final SearchProduct product;

  @override
  Widget build(BuildContext context) {
    final priceText = product.sellPriceValue != null
        ? NumberFormat.decimalPattern().format(product.sellPriceValue)
        : product.sellPrice;

    return _ResultCard(
      cardKey: Key('searchProductCard_${product.id}'),
      icon: Icons.inventory_2_outlined,
      color: AppColors.success,
      title: product.name,
      subtitle: '${product.sku} · $priceText',
      onTap: () => _showDetailSheet(
        context,
        title: product.name,
        icon: Icons.inventory_2_outlined,
        color: AppColors.success,
        rows: [
          ('Name', product.name),
          ('SKU', product.sku),
          ('Barcode', product.barcode ?? '—'),
          ('Sell price', priceText),
        ],
      ),
    );
  }
}

class _SaleCard extends StatelessWidget {
  const _SaleCard({required this.sale});

  final SearchSale sale;

  @override
  Widget build(BuildContext context) {
    final totalText = sale.grandTotalValue != null
        ? NumberFormat.decimalPattern().format(sale.grandTotalValue)
        : sale.grandTotal;
    final dateText = DateFormat('yyyy-MM-dd').format(sale.saleDate);

    return _ResultCard(
      cardKey: Key('searchSaleCard_${sale.id}'),
      icon: Icons.receipt_long_outlined,
      color: AppColors.primary,
      title: sale.number,
      subtitle: [sale.customerName ?? 'Walk-in', totalText, dateText].join(' · '),
      trailingBadge: _StatusBadge(status: sale.status),
      onTap: () => _showDetailSheet(
        context,
        title: sale.number,
        icon: Icons.receipt_long_outlined,
        color: AppColors.primary,
        rows: [
          ('Invoice #', sale.number),
          ('Customer', sale.customerName ?? 'Walk-in'),
          ('Grand total', totalText),
          ('Status', _statusLabel(sale.status)),
          ('Sale date', dateText),
        ],
      ),
    );
  }
}

class _PurchaseCard extends StatelessWidget {
  const _PurchaseCard({required this.purchase});

  final SearchPurchase purchase;

  @override
  Widget build(BuildContext context) {
    final totalText = purchase.grandTotalValue != null
        ? NumberFormat.decimalPattern().format(purchase.grandTotalValue)
        : purchase.grandTotal;
    final dateText = DateFormat('yyyy-MM-dd').format(purchase.invoiceDate);

    return _ResultCard(
      cardKey: Key('searchPurchaseCard_${purchase.id}'),
      icon: Icons.shopping_cart_outlined,
      color: AppColors.warning,
      title: purchase.number,
      subtitle: [purchase.supplierName, totalText, dateText].join(' · '),
      trailingBadge: _StatusBadge(status: purchase.status),
      onTap: () => _showDetailSheet(
        context,
        title: purchase.number,
        icon: Icons.shopping_cart_outlined,
        color: AppColors.warning,
        rows: [
          ('Invoice #', purchase.number),
          ('Supplier', purchase.supplierName),
          ('Grand total', totalText),
          ('Status', _statusLabel(purchase.status)),
          ('Invoice date', dateText),
        ],
      ),
    );
  }
}

/// Shows the full details of a single search result in a bottom sheet.
///
/// NOTE: There's no dedicated detail screen for customers / suppliers /
/// products / sales / purchases in the mobile app yet, so tapping a result
/// opens this generic key/value sheet instead of navigating anywhere. When
/// per-entity detail screens exist, swap this call for `context.push(...)`
/// in each card's `onTap` above.
Future<void> _showDetailSheet(
  BuildContext context, {
  required String title,
  required IconData icon,
  required Color color,
  required List<(String, String)> rows,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    builder: (context) => _DetailSheet(title: title, icon: icon, color: color, rows: rows),
  );
}

class _DetailSheet extends StatelessWidget {
  const _DetailSheet({required this.title, required this.icon, required this.color, required this.rows});

  final String title;
  final IconData icon;
  final Color color;
  final List<(String, String)> rows;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 4, 20, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(11),
                  ),
                  child: Icon(icon, color: color, size: 20),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    title,
                    style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            for (final row in rows)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 6),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    SizedBox(
                      width: 110,
                      child: Text(
                        row.$1,
                        style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant),
                      ),
                    ),
                    Expanded(
                      child: Text(
                        row.$2,
                        style: theme.textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600),
                      ),
                    ),
                  ],
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _SearchPromptState extends StatelessWidget {
  const _SearchPromptState();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.search, size: 40, color: theme.colorScheme.onSurfaceVariant),
            const SizedBox(height: 12),
            Text(
              'Search customers, suppliers, products, sales, and purchases',
              textAlign: TextAlign.center,
              style: theme.textTheme.titleMedium,
            ),
          ],
        ),
      ),
    );
  }
}

class _EmptySearchState extends StatelessWidget {
  const _EmptySearchState({required this.query});

  final String query;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.search_off, size: 40, color: theme.colorScheme.onSurfaceVariant),
            const SizedBox(height: 12),
            Text("No results for '$query'", style: theme.textTheme.titleMedium, textAlign: TextAlign.center),
          ],
        ),
      ),
    );
  }
}

class _SearchResultsShimmer extends StatelessWidget {
  const _SearchResultsShimmer();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final base = theme.colorScheme.surfaceContainerHighest;
    final highlight = theme.colorScheme.surface;

    return ListView.builder(
      key: const Key('globalSearchShimmer'),
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
      itemCount: 6,
      itemBuilder: (context, index) => Shimmer.fromColors(
        baseColor: base,
        highlightColor: highlight,
        child: Container(
          height: 64,
          margin: const EdgeInsets.only(bottom: 8),
          decoration: BoxDecoration(
            color: base,
            borderRadius: BorderRadius.circular(16),
          ),
        ),
      ),
    );
  }
}

class _SearchResultsError extends StatelessWidget {
  const _SearchResultsError({required this.onRetry});

  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.error_outline, size: 40, color: theme.colorScheme.error),
            const SizedBox(height: 12),
            Text('Could not load search results', style: theme.textTheme.titleMedium),
            const SizedBox(height: 16),
            FilledButton(onPressed: onRetry, child: const Text('Retry')),
          ],
        ),
      ),
    );
  }
}
