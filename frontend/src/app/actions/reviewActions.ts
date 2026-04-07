'use server'

import { revalidatePath } from 'next/cache'

export async function invalidateReviewsCache() {
    // Clear all cached review data across the application
    revalidatePath('/', 'layout')
}
