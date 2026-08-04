import 'package:equatable/equatable.dart';

/// The authenticated Super Admin user, as returned by `/auth/login`.
class MobileUser extends Equatable {
  const MobileUser({
    required this.id,
    required this.email,
    required this.name,
  });

  factory MobileUser.fromJson(Map<String, dynamic> json) => MobileUser(
        id: json['id'] as String,
        email: json['email'] as String,
        name: json['name'] as String,
      );

  final String id;
  final String email;
  final String name;

  @override
  List<Object?> get props => [id, email, name];
}
