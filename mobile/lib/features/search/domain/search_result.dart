import 'package:equatable/equatable.dart';

/// A matched customer, from `GlobalSearchResult.customers`.
class SearchCustomer extends Equatable {
  const SearchCustomer({
    required this.id,
    required this.name,
    required this.code,
    this.phone,
    this.email,
  });

  factory SearchCustomer.fromJson(Map<String, dynamic> json) => SearchCustomer(
        id: json['id'] as String? ?? '',
        name: json['name'] as String? ?? '',
        code: json['code'] as String? ?? '',
        phone: json['phone'] as String?,
        email: json['email'] as String?,
      );

  final String id;
  final String name;
  final String code;
  final String? phone;
  final String? email;

  @override
  List<Object?> get props => [id, name, code, phone, email];
}

/// A matched supplier, from `GlobalSearchResult.suppliers`.
class SearchSupplier extends Equatable {
  const SearchSupplier({
    required this.id,
    required this.name,
    required this.code,
    this.phone,
    this.email,
  });

  factory SearchSupplier.fromJson(Map<String, dynamic> json) => SearchSupplier(
        id: json['id'] as String? ?? '',
        name: json['name'] as String? ?? '',
        code: json['code'] as String? ?? '',
        phone: json['phone'] as String?,
        email: json['email'] as String?,
      );

  final String id;
  final String name;
  final String code;
  final String? phone;
  final String? email;

  @override
  List<Object?> get props => [id, name, code, phone, email];
}

/// A matched product, from `GlobalSearchResult.products`.
class SearchProduct extends Equatable {
  const SearchProduct({
    required this.id,
    required this.name,
    required this.sku,
    required this.sellPrice,
    this.barcode,
  });

  factory SearchProduct.fromJson(Map<String, dynamic> json) => SearchProduct(
        id: json['id'] as String? ?? '',
        name: json['name'] as String? ?? '',
        sku: json['sku'] as String? ?? '',
        barcode: json['barcode'] as String?,
        sellPrice: json['sellPrice'] as String? ?? '0',
      );

  final String id;
  final String name;
  final String sku;
  final String? barcode;

  /// Decimal serialized as a string by the backend (e.g. `"1250.5000"`).
  /// Parse with `double.tryParse` at the presentation layer.
  final String sellPrice;

  /// Parsed [sellPrice], or `null` when unparsable.
  double? get sellPriceValue => double.tryParse(sellPrice);

  @override
  List<Object?> get props => [id, name, sku, barcode, sellPrice];
}

/// A matched sales invoice, from `GlobalSearchResult.sales`.
class SearchSale extends Equatable {
  const SearchSale({
    required this.id,
    required this.number,
    required this.grandTotal,
    required this.status,
    required this.saleDate,
    this.customerName,
  });

  factory SearchSale.fromJson(Map<String, dynamic> json) => SearchSale(
        id: json['id'] as String? ?? '',
        number: json['number'] as String? ?? '',
        customerName: json['customerName'] as String?,
        grandTotal: json['grandTotal'] as String? ?? '0',
        status: json['status'] as String? ?? '',
        saleDate: DateTime.tryParse(json['saleDate'] as String? ?? '') ?? DateTime.now(),
      );

  final String id;
  final String number;
  final String? customerName;

  /// Decimal serialized as a string by the backend (e.g. `"1250.5000"`).
  /// Parse with `double.tryParse` at the presentation layer.
  final String grandTotal;
  final String status;
  final DateTime saleDate;

  /// Parsed [grandTotal], or `null` when unparsable.
  double? get grandTotalValue => double.tryParse(grandTotal);

  @override
  List<Object?> get props => [id, number, customerName, grandTotal, status, saleDate];
}

/// A matched purchase invoice, from `GlobalSearchResult.purchases`.
class SearchPurchase extends Equatable {
  const SearchPurchase({
    required this.id,
    required this.number,
    required this.supplierName,
    required this.grandTotal,
    required this.status,
    required this.invoiceDate,
  });

  factory SearchPurchase.fromJson(Map<String, dynamic> json) => SearchPurchase(
        id: json['id'] as String? ?? '',
        number: json['number'] as String? ?? '',
        supplierName: json['supplierName'] as String? ?? '',
        grandTotal: json['grandTotal'] as String? ?? '0',
        status: json['status'] as String? ?? '',
        invoiceDate: DateTime.tryParse(json['invoiceDate'] as String? ?? '') ?? DateTime.now(),
      );

  final String id;
  final String number;
  final String supplierName;

  /// Decimal serialized as a string by the backend (e.g. `"1250.5000"`).
  /// Parse with `double.tryParse` at the presentation layer.
  final String grandTotal;
  final String status;
  final DateTime invoiceDate;

  /// Parsed [grandTotal], or `null` when unparsable.
  double? get grandTotalValue => double.tryParse(grandTotal);

  @override
  List<Object?> get props => [id, number, supplierName, grandTotal, status, invoiceDate];
}

/// The full grouped result set from `GET /search`, as returned in `data`.
class GlobalSearchResult extends Equatable {
  const GlobalSearchResult({
    this.customers = const [],
    this.suppliers = const [],
    this.products = const [],
    this.sales = const [],
    this.purchases = const [],
  });

  factory GlobalSearchResult.fromJson(Map<String, dynamic> json) => GlobalSearchResult(
        customers: (json['customers'] as List<dynamic>? ?? const [])
            .map((e) => SearchCustomer.fromJson(e as Map<String, dynamic>))
            .toList(),
        suppliers: (json['suppliers'] as List<dynamic>? ?? const [])
            .map((e) => SearchSupplier.fromJson(e as Map<String, dynamic>))
            .toList(),
        products: (json['products'] as List<dynamic>? ?? const [])
            .map((e) => SearchProduct.fromJson(e as Map<String, dynamic>))
            .toList(),
        sales: (json['sales'] as List<dynamic>? ?? const [])
            .map((e) => SearchSale.fromJson(e as Map<String, dynamic>))
            .toList(),
        purchases: (json['purchases'] as List<dynamic>? ?? const [])
            .map((e) => SearchPurchase.fromJson(e as Map<String, dynamic>))
            .toList(),
      );

  final List<SearchCustomer> customers;
  final List<SearchSupplier> suppliers;
  final List<SearchProduct> products;
  final List<SearchSale> sales;
  final List<SearchPurchase> purchases;

  /// True when every category came back empty — used to drive the
  /// "No results for `<query>`" state.
  bool get isEmpty =>
      customers.isEmpty && suppliers.isEmpty && products.isEmpty && sales.isEmpty && purchases.isEmpty;

  @override
  List<Object?> get props => [customers, suppliers, products, sales, purchases];
}
