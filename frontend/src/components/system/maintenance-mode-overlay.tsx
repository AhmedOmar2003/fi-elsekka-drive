"use client";

import React from 'react';
import { usePathname } from 'next/navigation';
import { Bike, Sparkles, Wrench } from 'lucide-react';
import { fetchPublicAppSettings, DEFAULT_APP_SETTINGS } from '@/services/appSettingsService';

function isAdminPath(pathname: string) {
  return pathname.startsWith('/admin') || pathname.startsWith('/system-access');
}

function isDriverPath(pathname: string) {
  return pathname.startsWith('/driver');
}

export function MaintenanceModeOverlay() {
  const pathname = usePathname();
  const [maintenanceMode, setMaintenanceMode] = React.useState(false);
  const [siteName, setSiteName] = React.useState(DEFAULT_APP_SETTINGS.siteName);

  React.useEffect(() => {
    let active = true;

    const load = async () => {
      const settings = await fetchPublicAppSettings();
      if (!active) return;
      setMaintenanceMode(settings.maintenanceMode);
      setSiteName(settings.siteName || DEFAULT_APP_SETTINGS.siteName);
    };

    void load();

    const interval = window.setInterval(() => {
      void load();
    }, 15000);

    const onFocus = () => {
      void load();
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);

    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, []);

  if (!maintenanceMode || isAdminPath(pathname)) {
    return null;
  }

  const driverView = isDriverPath(pathname);
  const title = driverView ? 'إحنا بنظبط الشغل شوية' : 'إحنا بنظبط الدنيا شوية';
  const body = driverView
    ? 'استنى علينا شوية يا بطل. بنظبط كام حاجة ونحسن الأداء علشان الطلبات ترجعلك مظبوطة وسريعة.'
    : 'استنى علينا شوية. بنظبط كام حاجة ونحسن الأداء علشان تجربتك تبقى أسرع وأريح.';
  const hint = driverView
    ? 'أول ما نخلص الشغل هيرجع معاك عادي من غير ما تعمل حاجة.'
    : 'أول ما نخلص هتلاقي الموقع رجع لوحده، فخليك مطمن.';

  return (
    <div className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-xl">
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-lg overflow-hidden rounded-[32px] border border-primary/15 bg-surface shadow-2xl">
          <div className="h-2 bg-gradient-to-r from-primary via-emerald-400 to-primary" />
          <div className="p-6 sm:p-8 text-center">
            <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-[28px] bg-primary/10 text-primary shadow-lg shadow-primary/10">
              {driverView ? <Wrench className="h-10 w-10" /> : <Bike className="h-10 w-10" />}
            </div>
            <p className="text-sm font-black text-primary">{siteName}</p>
            <h2 className="mt-3 text-2xl font-heading font-black text-foreground">{title}</h2>
            <p className="mt-4 text-sm leading-8 text-gray-500">{body}</p>
            <div className="mt-5 rounded-3xl border border-primary/10 bg-primary/5 px-4 py-4">
              <div className="flex items-center justify-center gap-2 text-primary">
                <Sparkles className="h-4 w-4" />
                <p className="text-sm font-black">بنحسن الأداء ونظبط الحاجات اللي كانت عاوزة رتوشة سريعة</p>
              </div>
              <p className="mt-2 text-xs leading-6 text-gray-500">{hint}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

