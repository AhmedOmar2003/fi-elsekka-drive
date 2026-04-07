import { AdminProfile } from './admin-guard';

export type Permission =
  | 'view_orders'
  | 'update_order_status'
  | 'assign_driver'
  | 'view_drivers'
  | 'manage_products'
  | 'manage_categories'
  | 'manage_offers'
  | 'manage_discounts'
  | 'manage_users'
  | 'manage_admins'
  | 'manage_settings'
  | 'view_reports';

type RolePermShape = { role?: string | null; permissions?: string[] | null };

const ADMIN_DESTINATIONS: Array<{ path: string; perm?: Permission; fullAdmin?: boolean }> = [
  { path: '/admin', fullAdmin: true },
  { path: '/admin/trips', perm: 'view_orders' },
  { path: '/admin/dispatch', perm: 'assign_driver' },
  { path: '/admin/drivers', perm: 'view_drivers' },
  { path: '/admin/vehicles', perm: 'view_drivers' },
  { path: '/admin/support', perm: 'view_orders' },
  { path: '/admin/notifications', perm: 'manage_settings' },
  { path: '/admin/staff', perm: 'manage_admins' },
  { path: '/admin/settings', perm: 'manage_settings' },
];

export const PERMISSION_META: Record<Permission, { label: string; description: string }> = {
  view_orders: {
    label: 'عرض الطلبات',
    description: 'الموظف هيقدر يشوف الطلبات وتفاصيلها من لوحة الطلبات، لكن من غير صلاحيات إدارية إضافية لوحدها.',
  },
  update_order_status: {
    label: 'تحديث حالة الطلب',
    description: 'الموظف هيقدر يغيّر حالة الطلب مثل قيد التجهيز أو تم الشحن أو تم التوصيل حسب الشغل المسموح له.',
  },
  assign_driver: {
    label: 'تعيين مندوب',
    description: 'الموظف هيقدر يربط الطلب بمندوب مناسب ويتابع تسليمه من لوحة الطلبات.',
  },
  view_drivers: {
    label: 'عرض المندوبين',
    description: 'الموظف هيشوف قائمة المندوبين وحالتهم وتوفرهم من غير ما يدير باقي أقسام الإدارة.',
  },
  manage_products: {
    label: 'إدارة المنتجات',
    description: 'الموظف هيقدر يضيف ويعدل ويحذف المنتجات والباقات ويرتب بيانات العرض الخاصة بيها.',
  },
  manage_categories: {
    label: 'إدارة الأقسام',
    description: 'الموظف هيقدر يضيف الأقسام ويعدلها ويرتب ظهورها في المتجر.',
  },
  manage_offers: {
    label: 'إدارة العروض',
    description: 'الموظف هيقدر يشغّل المنتجات في قسم العروض ويتابع الظهور التجاري للعناصر المخفضة.',
  },
  manage_discounts: {
    label: 'إدارة أكواد الخصم',
    description: 'الموظف هيقدر ينشئ أكواد خصم ويحدد استخدامها ويربطها بمنتجات أو أقسام لو متاح.',
  },
  manage_users: {
    label: 'إدارة المستخدمين',
    description: 'الموظف هيقدر يراجع حسابات العملاء ويتابع بياناتهم وما يتعلق بإدارة المستخدمين.',
  },
  manage_admins: {
    label: 'إدارة الطاقم',
    description: 'الموظف هيقدر يضيف ويعدل الطاقم والصلاحيات ويعيد تعيين كلمات المرور للحسابات الإدارية.',
  },
  manage_settings: {
    label: 'إدارة الإعدادات',
    description: 'الموظف هيقدر يعدل إعدادات المتجر العامة ورسائل الصيانة وبعض إعدادات التشغيل.',
  },
  view_reports: {
    label: 'عرض التقارير',
    description: 'الموظف هيقدر يشوف التحليلات والتقارير والأرقام الخاصة بالمبيعات والزيارات والأداء.',
  },
};

export const ROLE_META: Record<string, { label: string; description: string }> = {
  super_admin: {
    label: 'مشرف عام',
    description: 'صلاحية كاملة وثابتة على كل أجزاء النظام، والحساب ده محمي من التعطيل والحذف من صفحة الطاقم.',
  },
  operations_manager: {
    label: 'إدارة العمليات',
    description: 'مناسب لمتابعة الطلبات وتحديث حالاتها وتعيين المندوبين ومراقبة التشغيل اليومي.',
  },
  catalog_manager: {
    label: 'إدارة المنتجات',
    description: 'مناسب لإضافة المنتجات وتعديل الأقسام والعروض وأكواد الخصم ومحتوى المتجر التجاري.',
  },
  support_agent: {
    label: 'دعم العملاء',
    description: 'مناسب لمتابعة الطلبات والرد على العملاء ومراجعة الحالة العامة بدون صلاحيات إدارية واسعة.',
  },
  admin: {
    label: 'أدمن',
    description: 'صلاحيات إدارية واسعة حسب بنية النظام الحالية.',
  },
};

export function getPermissionMeta(permission: Permission | string) {
  return PERMISSION_META[permission as Permission] || {
    label: permission,
    description: 'صلاحية داخلية في النظام.',
  };
}

export function getRoleMeta(role: string | null | undefined) {
  return ROLE_META[role || ''] || {
    label: role || 'غير محدد',
    description: 'دور داخل النظام.',
  };
}

export function hasPermission(profile: RolePermShape | null | undefined, perm: Permission) {
  if (!profile) return false;
  if (profile.role === 'super_admin' || profile.role === 'admin') return true;
  return Array.isArray(profile.permissions ?? []) && (profile.permissions as string[]).includes(perm);
}

export function hasFullAdminAccess(profile: RolePermShape | null | undefined) {
  if (!profile) return false;
  return profile.role === 'super_admin' || profile.role === 'admin';
}

export function getFirstAccessibleAdminPath(profile: RolePermShape | null | undefined) {
  if (!profile) return '/system-access/login';

  for (const destination of ADMIN_DESTINATIONS) {
    if (destination.fullAdmin) {
      if (hasFullAdminAccess(profile)) return destination.path;
      continue;
    }

    if (destination.perm && hasPermission(profile, destination.perm)) {
      return destination.path;
    }
  }

  return '/system-access/login?error=unauthorized';
}

export function requiredPermissionForPath(pathname: string): Permission | null {
  if (pathname.startsWith('/admin/trips')) return 'view_orders';
  if (pathname.startsWith('/admin/support')) return 'view_orders';
  if (pathname.startsWith('/admin/dispatch')) return 'assign_driver';
  if (pathname.startsWith('/admin/vehicles')) return 'view_drivers';
  if (pathname.startsWith('/admin/notifications')) return 'manage_settings';
  if (pathname.startsWith('/admin/backup')) return 'manage_settings';
  if (pathname.startsWith('/admin/staff')) return 'manage_admins';
  if (pathname.startsWith('/admin/users')) return 'manage_users';
  if (pathname.startsWith('/admin/restaurants')) return 'manage_products';
  if (pathname.startsWith('/admin/products')) return 'manage_products';
  if (pathname.startsWith('/admin/categories')) return 'manage_categories';
  if (pathname.startsWith('/admin/promotions')) return 'manage_offers';
  if (pathname.startsWith('/admin/discounts')) return 'manage_discounts';
  if (pathname.startsWith('/admin/settings')) return 'manage_settings';
  if (pathname.startsWith('/admin/reviews')) return 'view_reports';
  if (pathname.startsWith('/admin/orders')) return 'view_orders';
  if (pathname.startsWith('/admin/drivers')) return 'view_drivers';
  return null;
}
