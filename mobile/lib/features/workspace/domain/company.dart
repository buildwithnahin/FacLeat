import 'package:equatable/equatable.dart';

/// A single company/tenant, as returned by `GET /companies`.
class Company extends Equatable {
  const Company({required this.id, required this.name, required this.code});

  factory Company.fromJson(Map<String, dynamic> json) => Company(
        id: json['id'] as String,
        name: json['name'] as String,
        code: json['code'] as String? ?? '',
      );

  final String id;
  final String name;
  final String code;

  @override
  List<Object?> get props => [id, name, code];
}
