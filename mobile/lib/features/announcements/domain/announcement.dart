import 'package:equatable/equatable.dart';

/// The user who created an announcement, per the nested `createdBy`.
class AnnouncementAuthor extends Equatable {
  const AnnouncementAuthor({required this.id, required this.name});

  factory AnnouncementAuthor.fromJson(Map<String, dynamic> json) => AnnouncementAuthor(
        id: json['id'] as String? ?? '',
        name: json['name'] as String? ?? 'Unknown',
      );

  final String id;
  final String name;

  @override
  List<Object?> get props => [id, name];
}

/// The branch an announcement targets, per the nested `audienceBranch`
/// (only present when `audienceType == 'BRANCH'`).
class AnnouncementBranchRef extends Equatable {
  const AnnouncementBranchRef({required this.id, required this.name});

  factory AnnouncementBranchRef.fromJson(Map<String, dynamic> json) => AnnouncementBranchRef(
        id: json['id'] as String? ?? '',
        name: json['name'] as String? ?? '',
      );

  final String id;
  final String name;

  @override
  List<Object?> get props => [id, name];
}

/// A document attached to an announcement. Only present on the
/// `GET /announcements/:id` response — v1 has no upload flow so this is
/// always empty in practice today, but the shape is rendered defensively.
class AnnouncementAttachment extends Equatable {
  const AnnouncementAttachment({
    required this.id,
    required this.fileName,
    required this.originalName,
    required this.mimeType,
    required this.size,
    required this.linkId,
    this.category,
    this.linkNote,
  });

  factory AnnouncementAttachment.fromJson(Map<String, dynamic> json) => AnnouncementAttachment(
        id: json['id'] as String? ?? '',
        fileName: json['fileName'] as String? ?? '',
        originalName: json['originalName'] as String? ?? '',
        mimeType: json['mimeType'] as String? ?? 'application/octet-stream',
        size: json['size'] as int? ?? 0,
        category: json['category'] as String?,
        linkId: json['linkId'] as String? ?? '',
        linkNote: json['linkNote'] as String?,
      );

  final String id;
  final String fileName;
  final String originalName;
  final String mimeType;
  final int size;
  final String? category;
  final String linkId;
  final String? linkNote;

  @override
  List<Object?> get props =>
      [id, fileName, originalName, mimeType, size, category, linkId, linkNote];
}

/// A business announcement, as returned by `GET /announcements`,
/// `GET /announcements/:id`, and `POST /announcements`.
///
/// [recipientCount] is only populated on the create (POST) response, and
/// [attachments] only on the detail (GET :id) response — both default to
/// their "absent" shape ([null] / empty list) on the other endpoints.
class Announcement extends Equatable {
  const Announcement({
    required this.id,
    required this.title,
    required this.body,
    required this.audienceType,
    required this.createdById,
    required this.createdAt,
    required this.updatedAt,
    this.audienceBranchId,
    this.audienceDepartment,
    this.audienceUserId,
    this.createdBy,
    this.audienceBranch,
    this.recipientCount,
    this.attachments = const [],
  });

  factory Announcement.fromJson(Map<String, dynamic> json) => Announcement(
        id: json['id'] as String? ?? '',
        title: json['title'] as String? ?? '',
        body: json['body'] as String? ?? '',
        audienceType: json['audienceType'] as String? ?? 'ALL',
        audienceBranchId: json['audienceBranchId'] as String?,
        audienceDepartment: json['audienceDepartment'] as String?,
        audienceUserId: json['audienceUserId'] as String?,
        createdById: json['createdById'] as String? ?? '',
        createdAt: DateTime.tryParse(json['createdAt'] as String? ?? '') ?? DateTime.now(),
        updatedAt: DateTime.tryParse(json['updatedAt'] as String? ?? '') ?? DateTime.now(),
        createdBy: json['createdBy'] is Map
            ? AnnouncementAuthor.fromJson(Map<String, dynamic>.from(json['createdBy'] as Map))
            : null,
        audienceBranch: json['audienceBranch'] is Map
            ? AnnouncementBranchRef.fromJson(
                Map<String, dynamic>.from(json['audienceBranch'] as Map))
            : null,
        recipientCount: json['recipientCount'] as int?,
        attachments: (json['attachments'] as List<dynamic>? ?? const [])
            .map((e) => AnnouncementAttachment.fromJson(e as Map<String, dynamic>))
            .toList(),
      );

  final String id;
  final String title;
  final String body;

  /// One of `ALL` / `BRANCH` / `DEPARTMENT` / `USER`.
  final String audienceType;
  final String? audienceBranchId;
  final String? audienceDepartment;
  final String? audienceUserId;
  final String createdById;
  final DateTime createdAt;
  final DateTime updatedAt;
  final AnnouncementAuthor? createdBy;
  final AnnouncementBranchRef? audienceBranch;

  /// Only present on the `POST /announcements` create response.
  final int? recipientCount;

  /// Only present (non-empty) on the `GET /announcements/:id` response.
  final List<AnnouncementAttachment> attachments;

  /// Human summary of who this announcement targets, for the list badge and
  /// detail screen — mirrors the shape of `AdminUser.branchAccessSummary`.
  String get audienceLabel {
    switch (audienceType) {
      case 'BRANCH':
        return 'Branch: ${audienceBranch?.name ?? 'Unknown'}';
      case 'DEPARTMENT':
        return 'Department: ${audienceDepartment ?? 'Unknown'}';
      case 'USER':
        return 'One user';
      case 'ALL':
      default:
        return 'All Users';
    }
  }

  @override
  List<Object?> get props => [
        id,
        title,
        body,
        audienceType,
        audienceBranchId,
        audienceDepartment,
        audienceUserId,
        createdById,
        createdAt,
        updatedAt,
        createdBy,
        audienceBranch,
        recipientCount,
        attachments,
      ];
}
