'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Mobile browsers (iOS Safari, Chrome Android) restore the previous page from
// bfcache on hardware/gesture back — no JS reruns, no RSC refetch. Detecting
// `pageshow.persisted` and calling router.refresh() forces fresh server data.
export function BfcacheRefresh() {
  const router = useRouter();
  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) router.refresh();
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, [router]);
  return null;
}
