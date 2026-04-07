import { supabase } from '@/lib/supabase';
import { optimizeImageForUpload } from '@/lib/image-upload';

export const TEXT_CATEGORY_ORDER_MODE = 'text-category';

const DEFAULT_TEXT_REQUEST_CATEGORY_CONFIG = {
  allowText: true,
  requireText: false,
  allowImages: true,
  maxImages: 3,
  requestOnly: false,
} as const;

const TEXT_REQUEST_CATEGORY_CONFIG = {
  'صيدلية': {
    allowText: true,
    requireText: false,
    allowImages: true,
    maxImages: 3,
    requestOnly: true,
  },
} as const;

export const TEXT_REQUEST_CATEGORY_NAMES = Object.keys(TEXT_REQUEST_CATEGORY_CONFIG);

export type TextCategoryOrderDraft = {
  categoryId: string;
  categoryName: string;
  requestText: string;
  imageUrls?: string[];
};

export function isTextRequestCategory(name?: string | null) {
  return TEXT_REQUEST_CATEGORY_NAMES.includes((name || '').trim());
}

export function getTextRequestCategoryConfig(name?: string | null) {
  const normalizedName = (name || '').trim();
  if (!normalizedName) return null;
  return TEXT_REQUEST_CATEGORY_CONFIG[normalizedName as keyof typeof TEXT_REQUEST_CATEGORY_CONFIG] || DEFAULT_TEXT_REQUEST_CATEGORY_CONFIG;
}

export function isRequestOnlyTextCategory(name?: string | null) {
  return getTextRequestCategoryConfig(name)?.requestOnly === true;
}

export function getTextCategoryOrderDraftKey(categoryId: string) {
  return `text-category-order-draft:${categoryId}`;
}

export function readTextCategoryOrderDraft(categoryId: string): TextCategoryOrderDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(getTextCategoryOrderDraftKey(categoryId));
    return raw ? JSON.parse(raw) as TextCategoryOrderDraft : null;
  } catch {
    return null;
  }
}

export function writeTextCategoryOrderDraft(draft: TextCategoryOrderDraft) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(getTextCategoryOrderDraftKey(draft.categoryId), JSON.stringify(draft));
}

export function clearTextCategoryOrderDraft(categoryId: string) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(getTextCategoryOrderDraftKey(categoryId));
}

export async function uploadTextCategoryRequestImage(categoryId: string, file: File) {
  const optimizedFile = await optimizeImageForUpload(file, { maxDimension: 1600, quality: 0.82 });
  const ext = optimizedFile.name.split('.').pop() || 'webp';
  const safeCategoryId = categoryId.replace(/[^a-zA-Z0-9_-]/g, '');
  const fileName = `category-requests/${safeCategoryId}/${Date.now()}-${Math.random().toString(36).slice(2, 9)}.${ext}`;

  const { error } = await supabase.storage
    .from('review-images')
    .upload(fileName, optimizedFile, {
      cacheControl: '3600',
      upsert: false,
      contentType: optimizedFile.type || 'image/webp',
    });

  if (error) {
    console.error('uploadTextCategoryRequestImage error:', error);
    return null;
  }

  const { data } = supabase.storage.from('review-images').getPublicUrl(fileName);
  return data.publicUrl;
}
